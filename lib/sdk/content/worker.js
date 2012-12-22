/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require("../core/heritage");
const { Disposable } = require("../core/disposable");
const { WorkerSandbox, importScripts, evaluateScript } = require("./sandbox");
const { ns } = require("../core/namespace");
const { EventTarget } = require("../event/target");
const { emit, on, off, setListeners } = require("../event/core");
const { Port, connect, disconnect, pause,
        resume, flush, isPaused } = require("./port");
const { Ci, Cu } = require('chrome');
const { method } = require("../lang/functional");
const { getTabForWindow } = require('../tabs/helpers');
const { contentUnload } = require("./states");
const { getInnerId } = require('../window/utils');

/**
 * This key is not exported and should only be used for proxy tests.
 * The following `PRIVATE_KEY` is used in addon module scope in order to tell
 * Worker API to expose `UNWRAP_ACCESS_KEY` in content script.
 * This key allows test-content-proxy.js to unwrap proxy with valueOf:
 *   let xpcWrapper = proxyWrapper.valueOf(UNWRAP_ACCESS_KEY);
 */
const PRIVATE_KEY = {};


function onPageShow(instance) {
  return function pageShow() {
    let { contentWorker, model } = worker(instance);
    resume(instance.port);
    emit(contentWorker, "!pageshow");
    emit(instance, "pageshow");
  }
}

function onPageHide(instance) {
  return function pageHide() {
    let { contentWorker, model } = worker(instance);
    pause(instance.port);
    emit(contentWorker, "!pagehide");
    emit(instance, "pagehide")
  }
}

let worker = ns();

/**
 * Message-passing facility for communication between code running
 * in the content and add-on process.
 * @see https://jetpack.mozillalabs.com/sdk/latest/docs/#module/api-utils/content/worker
 */
const Worker = Class({
  implements: [Disposable],
  extends: EventTarget,

  get contentScriptOptions() { return worker(this).model.contentScriptOptions },
  get contentScriptFile() { return worker(this).model.contentScriptFile },
  get contentScript() { return worker(this).model.contentScript },

  /**
   * Sends a message to the worker's global scope. Method takes single
   * argument, which represents data to be sent to the worker. The data may
   * be any primitive type value or `JSON`. Call of this method asynchronously
   * emits `message` event with data value in the global scope of this
   * symbiont.
   *
   * `message` event listeners can be set either by calling
   * `self.on` with a first argument string `"message"` or by
   * implementing `onMessage` function in the global scope of this worker.
   * @param {Number|String|JSON} data
   */
  postMessage: function postMessage(data) {
    this.port.emit("message", data);
  },

  /**
   * EventEmitter, that behaves (calls listeners) asynchronously.
   * A way to send customized messages to / from the worker.
   * Events from in the worker can be observed / emitted via
   * worker.on / worker.emit.
   */
  get port() { return worker(this).port },

  setup: method(setup),

  get url() {
    // this._window will be null after detach
    let { view } = worker(this);
    return view && view.document.URL;
  },

  get tab() {
    // this._window will be null after detach
    let { view } = worker(this);
    return view && getTabForWindow(view);
  },

  dispose: function dispose() {
    detach(this);
    this.port.destroy();
    off(this);
  }
});
exports.Worker = Worker;

/**
 * Remove all internal references to the window that worker instance has being
 * attached to. Unloads content side of the worker and removes all the
 * references to it.
 */
function detach(instance) {
  // maybe unloaded before content side is created
  // As Symbiont call worker.constructor on document load
  let internal = worker(instance);
  let { contentWorker, model, view } = internal;

  if (model.isAttached) {
    if (contentWorker) {
      emit(contentWorker, "!detach");
      internal.contentWorker = null;
      Cu.nukeSandbox(contentWorker);
    }

    if (view) {
      internal.view = null;

      view.removeEventListener("pageshow", internal.pageShow, true);
      internal.pageShow = null;

      view.removeEventListener("pagehide", internal.pageHide, true);
      internal.pageHide = null;
    }

    disconnect(instance.port);
    model.isAttached = false;

    emit(instance, "detach");
  }
}
exports.detach = detach;

// Function attaches given worker instance to a given window.
function attach(instance, view) {
  let internal = worker(instance);
  let { model, port } = internal;

  if (model.isAttached) throw Error("Worker is already attached");

  internal.view = view;

  // Listen to pagehide event in order to freeze the content script
  // while the document is frozen in bfcache:
  internal.pageShow = onPageShow(instance);
  view.addEventListener("pageshow", internal.pageShow, true);
  internal.pageHide = onPageHide(instance);
  view.addEventListener("pagehide", internal.pageHide, true);

  // Track document unload to detach this worker.
  let innerID = getInnerId(view);
  contentUnload(function(id) { return id === innerID }).then(function() {
    detach(instance);
  }).then(null, console.exception);

  // will set this._contentWorker pointing to the private API:
  let contentWorker = WorkerSandbox({
    host: port,
    context: view,
    injectInDocument: model.injectInDocument,
    exposeKey: model.exposeKey,
    options: model.contentScriptOptions
  });
  internal.contentWorker = contentWorker;

  // The order of `contentScriptFile` and `contentScript` evaluation is
  // intentional, so programs can load libraries like jQuery from script URLs
  // and use them in scripts.
  let contentScriptFile = model.contentScriptFile &&
                          [].concat(model.contentScriptFile);
  let contentScript = model.contentScript &&
                      [].concat(model.contentScript).join(';\n');

  try {
    if (contentScriptFile) importScripts(contentWorker, contentScriptFile);
    if (contentScript) evaluateScript(contentWorker, contentScript);
  } catch (error) {
    emit(instance, "error", error);
  }

  // Mainly enable worker.port.emit to send event to the content worker
  model.isAttached = true;

  connect(port, contentWorker);
  flush(port);
}
exports.attach = attach;

function setup(instance, options) {
  options = options || {};
  let internal = worker(instance);
  let model = {
    exposeKey: false,
    isAttached: false,
    // Flag to enable `addon` object injection in document. (bug 612726)
    injectInDocument: false
  }
  internal.model = model;

  if ('contentScriptFile' in options)
    model.contentScriptFile = options.contentScriptFile;
  if ('contentScriptOptions' in options)
    model.contentScriptOptions = options.contentScriptOptions;
  if ('contentScript' in options)
    model.contentScript = options.contentScript;

  setListeners(instance, options);

  // Internal feature that is only used by SDK unit tests.
  // See `PRIVATE_KEY` definition for more information.
  if ('exposeUnlockKey' in options && options.exposeUnlockKey === PRIVATE_KEY)
    model.exposeKey = true;

  let port = Port();
  internal.port = port;

  // Log console messages when they arrive on the port from content.
  on(port, "console", function onConsole(level) {
    console[level].apply(console, Array.slice(arguments, 1));
  });
  // forward message events on port to the worker itself.
  on(port, "message", function onMessage(message) {
    emit(instance, "message", message);
  });

  let view = options.window;
  if (view) attach(instance, view);
}
exports.setup = setup;
