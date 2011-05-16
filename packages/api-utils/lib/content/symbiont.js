/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Myk Melez <myk@mozilla.org> (Original Author)
 *   Irakli Gozalishvili <gozala@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
"use strict";

const { Worker } = require('./worker');
const { Loader } = require('./loader');
const hiddenFrames = require("hidden-frame");
const observers = require('observer-service');
const unload = require("unload");

/**
 * This trait is layered on top of `Worker` and in contrast to symbiont
 * Worker constructor requires `content` option that represents content
 * that will be loaded in the provided frame, if frame is not provided
 * Worker will create hidden one.
 */
const Symbiont = Worker.resolve({
    constructor: '_initWorker',
    destroy: '_workerDestroy'
  }).compose(Loader, {
  
  /**
   * The constructor requires all the options that are required by
   * `require('content').Worker` with the difference that the `frame` option
   * is optional. If `frame` is not provided, `contentURL` is expected.
   * @param {Object} options
   * @param {String} options.contentURL
   *    URL of a content to load into `this._frame` and create worker for.
   * @param {Element} [options.frame]
   *    iframe element that is used to load `options.contentURL` into.
   *    if frame is not provided hidden iframe will be created.
   */
  constructor: function Symbiont(options) {
    options = options || {};

    if ('contentURL' in options)
        this.contentURL = options.contentURL;
    if ('contentScriptWhen' in options)
      this.contentScriptWhen = options.contentScriptWhen;
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
      this._initFrame(options.frame);
    }
    else {
      let self = this;
      this._hiddenFrame = hiddenFrames.HiddenFrame({
        onReady: function onFrame() {
          self._initFrame(this.element);
        }
      });
      hiddenFrames.add(this._hiddenFrame);
    }

    unload.ensure(this._public, "destroy");
  },
  
  destroy: function destroy() {
    this._workerDestroy();
    this._unregisterListener();
    this._frame = null;
    if (this._hiddenFrame) {
      hiddenFrames.remove(this._hiddenFrame);
      this._hiddenFrame = null;
    }
  },
  
  /**
   * XUL iframe or browser elements with attribute `type` being `content`.
   * Used to create `ContentSymbiont` from.
   * @type {nsIFrame|nsIBrowser}
   */
  _frame: null,
  
  /**
   * Listener to the `'frameReady"` event (emitted when `iframe` is ready).
   * Removes listener, sets right permissions to the frame and loads content.
   */
  _initFrame: function _initFrame(frame) {
    if (this._loadListener)
      this._unregisterListener();
    
    this._frame = frame;
    frame.docShell.allowJavascript = this.allow.script;
    frame.setAttribute("src", this._contentURL);
    
    if ((frame.contentDocument.readyState == "complete" ||
        (frame.contentDocument.readyState == "interactive" &&
         this.contentScriptWhen != 'end' )) &&
        frame.contentDocument.location == this._contentURL) {
      // In some cases src doesn't change and document is already ready
      // (for ex: when the user moves a widget while customizing toolbars.)
      this._onInit();
      return;
    }
    
    let self = this;
    
    if ('start' == this.contentScriptWhen) {
      this._loadEvent = 'start';
      observers.add('document-element-inserted', 
        this._loadListener = function onStart(doc) {
          
          let window = doc.defaultView;
          if (window && window == frame.contentWindow) {
            self._unregisterListener();
            self._onInit();
          }
          
        });
      return;
    }
    
    let eventName = 'end' == this.contentScriptWhen ? 'load' : 'DOMContentLoaded';
    let self = this;
    this._loadEvent = eventName;
    frame.addEventListener(eventName, 
      this._loadListener = function _onReady(event) {
      
        if (event.target != frame.contentDocument)
          return;
        self._unregisterListener();
        
        self._onInit();
        
      }, true);
    
  },
  
  /**
   * Unregister listener that watchs for document being ready to be injected.
   * This listener is registered in `Symbiont._initFrame`.
   */
  _unregisterListener: function _unregisterListener() {
    if (!this._loadListener)
      return;
    if (this._loadEvent == "start") {
      observers.remove('document-element-inserted', this._loadListener);
    }
    else {
      this._frame.removeEventListener(this._loadEvent, this._loadListener,
                                      true);
    }
    this._loadListener = null;
  },
  
  /**
   * Called by Symbiont itself when the frame is ready to load  
   * content scripts according to contentScriptWhen. Overloaded by Panel. 
   */
  _onInit: function () {
    this._initWorker({ window: this._frame.contentWindow.wrappedJSObject });
  }
  
});
exports.Symbiont = Symbiont;
