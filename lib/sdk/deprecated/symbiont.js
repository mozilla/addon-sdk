/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "deprecated"
};

const { Class } = require('../core/heritage');
const { Disposable } = require('../core/disposable');
const { Bond } = require('../util/bond');
const { Worker } = require('./legacy-worker');
const { Loader } = require('../content/loader');
const { on, off } = require('../system/events');
const { getDocShell } = require("../frame/utils");
const { ignoreWindow } = require('../private-browsing/utils');
const hiddenFrames = require('../frame/hidden-frame');

// Everything coming from add-on's xpi considered an asset.
const assetsURI = require('../self').data.url().replace(/data\/$/, "");

// Private interface

const setupWorker = Symbol("deprecated/symbiont/setup-worker");
const disposeWorker = Symbol("deprecated/symbiont/dispose-worker");

const attachFrame = Symbol("deprecated/symbiont/attach-frame");
const detachFrame = Symbol("deprecated/symbiont/detach-frame");
const setupFrame = Symbol("deprecated/symbol/setup-frame");

const frame = Symbol("deprecated/symbiont/frame");
const hiddenFrame = Symbol("deprecated/symbiont/hidden-frame");

const injectInDocument = Worker.injectInDocument;
const onAttach = Symbol("deprecated/symbiont/on-frame-attached");
const onStart = Symbol("deprecated/symbiont/on-start");
const onReadyStateChange = Symbol("deprecated/symbiont/on-ready-state-change")
const onFrameReady = Symbol("deprecated/symbiont/on-frame-ready");

/**
 * This trait is layered on top of `Worker` and in contrast to symbiont
 * Worker constructor requires `content` option that represents content
 * that will be loaded in the provided frame, if frame is not provided
 * Worker will create hidden one.
 */
const Symbiont = Class({
  implements: [
    Worker,
    Loader,
    Disposable,
    Bond({
      [onAttach]({subject, topic}) {
        if (this[frame].contentWindow == subject) {
          off(topic, this[onAttach]);
          this[setupFrame](this[frame]);
        }
      },
      [onStart]({subject, topic}) {
        const window = subject.defaultView;
        if (window &&
            !ignoreWindow(window) &&
            window == this[frame].contentWindow)
        {
          off(topic, this[onStart]);
          this[onFrameReady]();
        }
      },
      [onReadyStateChange]({type, target}) {
        if (target === this[frame].contentDocument) {
          target.removeEventListener(type, this[onReadyStateChange], true);
          this[onFrameReady]();
        }
      }
    })
  ],
  [setupWorker]: Worker.prototype.setup,
  [disposeWorker]: Worker.prototype.dispose,
  /**
   * The constructor requires all the options that are required by
   * `require('content').Worker` with the difference that the `frame` option
   * is optional. If `frame` is not provided, `contentURL` is expected.
   * @param {Object} options
   * @param {String} options.contentURL
   *    URL of a content to load into `this[frame]` and create worker for.
   * @param {Element} [options.frame]
   *    iframe element that is used to load `options.contentURL` into.
   *    if frame is not provided hidden iframe will be created.
   */
  setup(options={}) {
    if ('contentURL' in options)
        this.contentURL = options.contentURL;
    if ('contentScriptWhen' in options)
      this.contentScriptWhen = options.contentScriptWhen;
    if ('contentScriptOptions' in options)
      this.contentScriptOptions = options.contentScriptOptions;
    if ('contentScriptFile' in options)
      this.contentScriptFile = options.contentScriptFile;
    if ('contentScript' in options)
      this.contentScript = options.contentScript;
    if ('allow' in options)
      this.allow = options.allow;
    if ('onError' in options)
        this.on('error', options.onError);
    if ('onMessage' in options)
        this.on('message', options.onMessage);
    if ('frame' in options) {
      this[attachFrame](options.frame);
    }
    else {
      this[hiddenFrame] = hiddenFrames.HiddenFrame({
        onReady: (element) => {
          this[attachFrame](element);
        },
        onUnload: () => {
          // Bug 751211: Remove reference to this[frame] when hidden frame is
          // automatically removed on unload, otherwise we are going to face
          // "dead object" exception
          this.destroy();
        }
      });
      hiddenFrames.add(this[hiddenFrame]);
    }
  },

  dispose() {
    this[disposeWorker]();
    this[detachFrame]();
    if (this[hiddenFrame]) {
      hiddenFrames.remove(this[hiddenFrame]);
      this[hiddenFrame] = null;
    }
  },

  /**
   * XUL iframe or browser elements with attribute `type` being `content`.
   * Used to create `ContentSymbiont` from.
   * @type {nsIFrame|nsIBrowser}
   */
  [frame]: null,

  /**
   * Listener to the `'frameReady"` event (emitted when `iframe` is ready).
   * Removes listener, sets right permissions to the frame and loads content.
   */
  [attachFrame](target) {
    this[detachFrame]();
    this[frame] = target;

    if (getDocShell(target)) {
      this[setupFrame](target);
    }
    else {
      on('content-document-global-created', this[onAttach]);
    }
  },

  [setupFrame](frame) {
    getDocShell(frame).allowJavascript = this.allow.script;
    frame.setAttribute("src", this.contentURL);

    // Inject `addon` object in document if we load a document from
    // one of our addon folder and if no content script are defined. bug 612726
    let isDataResource =
      typeof this.contentURL == "string" &&
      this.contentURL.indexOf(assetsURI) == 0;
    let hasContentScript =
      (Array.isArray(this.contentScript) ? this.contentScript.length > 0
                                             : !!this.contentScript) ||
      (Array.isArray(this.contentScriptFile) ? this.contentScriptFile.length > 0
                                             : !!this.contentScriptFile);
    // If we have to inject `addon` we have to do it before document
    // script execution, so during `start`:
    this[injectInDocument] = isDataResource && !hasContentScript;
    if (this[injectInDocument]) {
      this.contentScriptWhen = "start";
    }

    if ((frame.contentDocument.readyState == "complete" ||
        (frame.contentDocument.readyState == "interactive" &&
         this.contentScriptWhen != 'end' )) &&
        frame.contentDocument.location == this.contentURL)
    {
      // In some cases src doesn't change and document is already ready
      // (for ex: when the user moves a widget while customizing toolbars.)
      this[onFrameReady]();
    }
    else if (this.contentScriptWhen === 'start') {
      on('document-element-inserted', this[onStart]);
    }
    else if (this.contentScriptWhen === 'ready') {
      frame.addEventListener('DOMContentLoaded', this[onReadyStateChange], true);
    }
    else {
      frame.addEventListener('load', this[onReadyStateChange], true);
    }
  },

  /**
   * Unregister listener that watchs for document being ready to be injected.
   * This listener is registered in `this[attachFrame]`.
   */
  [detachFrame]() {
    const target = this[frame];
    if (target) {
      off('content-document-global-created', this[onAttach]);
      off('document-element-inserted', this[onStart]);
      target.removeEventListener("load", this[onReadyStateChange], true);
      target.removeEventListener("DOMContentLoaded", this[onReadyStateChange], true);
      this[frame] = null;
    }
  },

  /**
   * Called by Symbiont itself when the frame is ready to load
   * content scripts according to contentScriptWhen. Overloaded by Panel.
   */
  [onFrameReady]() {
    this[setupWorker]({window: this[frame].contentWindow});
  }
});
exports.Symbiont = Symbiont;
