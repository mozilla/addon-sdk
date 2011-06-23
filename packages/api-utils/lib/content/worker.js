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

const { shims } = require('cuddlefish');
const { Trait } = require('traits');
const { EventEmitter, EventEmitterTrait } = require('events');
const { Ci, Cu, Cc } = require('chrome');
const timer = require('timer');
const { toFilename } = require('url');
const file = require('file');
const unload = require('unload');
const observers = require("observer-service");
const { Cortex } = require('cortex');
const { Enqueued } = require('utils/function');
const proxy = require('content/content-proxy');

const JS_VERSION = '1.8';

const ERR_DESTROYED =
  "The page has been destroyed and can no longer be used.";


function ensureArgumentsAreJSON(args) {
  // First convert to real array
  let array = Array.prototype.slice.call(args);
  // JSON.stringify is buggy with cross-sandbox values,
  // it may return "{}" on functions. Use a replacer to match them correctly.
  function replacer(k, v) {
    return typeof v === "function" ? undefined : v;
  }
  return JSON.parse(JSON.stringify(array, replacer));
}

/**
 * Extended `EventEmitter` allowing us to emit events asynchronously.
 */
const AsyncEventEmitter = EventEmitter.compose({
  /**
   * Emits event in the next turn of event loop.
   */
  _asyncEmit: function _asyncEmit() {
    timer.setTimeout(function emitter(emit, scope, params) {
      emit.apply(scope, params);
    }, 0, this._emit, this, arguments)
  }
});

/**
 * Local trait providing implementation of the workers global scope.
 * Used to configure global object in the sandbox.
 * @see http://www.w3.org/TR/workers/#workerglobalscope
 */
const WorkerGlobalScope = AsyncEventEmitter.compose({
  on: Trait.required,
  _removeAllListeners: Trait.required,

  // wrapped functions from `'timer'` module.
  // Wrapper adds `try catch` blocks to the callbacks in order to
  // emit `error` event on a symbiont if exception is thrown in
  // the Worker global scope.
  // @see http://www.w3.org/TR/workers/#workerutils
  setTimeout: function setTimeout(callback, delay) {
    let params = Array.slice(arguments, 2);
    return timer.setTimeout(function(worker) {
      try {
        callback.apply(null, params);
      } catch(e) {
        worker._asyncEmit('error', e);
      }
    }, delay, this._addonWorker);
  },
  clearTimeout: timer.clearTimeout,

  setInterval: function setInterval(callback, delay) {
    let params = Array.slice(arguments, 2);
    return timer.setInterval(function(worker) {
      try {
        callback.apply(null, params); 
      } catch(e) {
        worker._asyncEmit('error', e);
      }
    }, delay, this._addonWorker);
  },
  clearInterval: timer.clearInterval,

  /**
   * `onMessage` function defined in the global scope of the worker context.
   */
  get _onMessage() this.__onMessage,
  set _onMessage(value) {
    let listener = this.__onMessage;
    if (listener && value !== listener) {
      this.removeListener('message', listener);
      this.__onMessage = undefined;
    }
    if (value)
      this.on('message', this.__onMessage = value);
  },
  __onMessage: undefined,

  /**
   * Function for sending data to the addon side.
   * Validates that data is a `JSON` or primitive value and emits
   * 'message' event on the worker in the next turn of the event loop.
   * _Later this will be sending data across process boundaries._
   * @param {JSON|String|Number|Boolean} data
   */
  postMessage: function postMessage(data) {
    if (!this._addonWorker)
      throw new Error(ERR_DESTROYED);
    this._addonWorker._asyncEmit('message',  
                                      JSON.parse(JSON.stringify(data)));
  },
  
  /**
   * EventEmitter, that behaves (calls listeners) asynchronously.
   * A way to send customized messages to / from the worker.
   * Events from in the worker can be observed / emitted via self.on / self.emit 
   */
  get port() this._port._public,
  
  /**
   * Same object than this.port but private API.
   * Allow access to _asyncEmit, in order to send event to port.
   */
  _port: null,

  /**
   * Alias to the global scope in the context of worker. Similar to
   * `window` concept.
   */
  get self() this._public,

  /**
   * Configures sandbox and loads content scripts into it.
   * @param {Worker} worker
   *    content worker
   */
  constructor: function WorkerGlobalScope(worker) {
    this._addonWorker = worker;
    
    // Hack in order to allow addon worker to access _asyncEmit
    // as this is the private object of WorkerGlobalScope
    worker._contentWorker = this;
    
    // create an event emitter that receive and send events from/to the addon
    let contentWorker = this;
    this._port = EventEmitterTrait.create({
      emit: function () {
        let addonWorker = contentWorker._addonWorker;
        if (!addonWorker)
          throw new Error(ERR_DESTROYED);
        addonWorker._onContentScriptEvent.apply(addonWorker, arguments);
      }
    });
    // create emit that executes in next turn of event loop.
    this._port._asyncEmit = Enqueued(this._port._emit);
    // expose wrapped port, that exposes only public properties. 
    this._port._public = Cortex(this._port);
    
    // We receive an unwrapped window, with raw js access
    let window = worker._window;
    
    // Create the sandbox and bind it to window in order for content scripts to
    // have access to all standard globals (window, document, ...)
    let sandbox = this._sandbox = new Cu.Sandbox(window, {
      sandboxPrototype: proxy.create(window),
      wantXrays: false
    });
    Object.defineProperties(sandbox, {
      window: { get: function() sandbox },
      top: { get: function() sandbox },
      // Use the Greasemonkey naming convention to provide access to the
      // unwrapped window object so the content script can access document
      // JavaScript values.
      // NOTE: this functionality is experimental and may change or go away
      // at any time!
      unsafeWindow: { get: function () window }
    });
    
    // Overriding / Injecting some natives into sandbox.
    Cu.evalInSandbox(shims.contents, sandbox, JS_VERSION, shims.filename);
    
    let publicAPI = this._public;
    
    // List of content script globals:
    let keys = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 
                'self'];
    for each (let key in keys) {
      Object.defineProperty(
        sandbox, key, Object.getOwnPropertyDescriptor(publicAPI, key)
      );
    }
    let self = this;
    Object.defineProperties(sandbox, {
      onMessage: {
        get: function() self._onMessage,
        set: function(value) {
          console.warn("The global `onMessage` function in content scripts " +
                       "is deprecated in favor of the `self.on()` function. " +
                       "Replace `onMessage = function (data){}` definitions " +
                       "with calls to `self.on('message', function (data){})`.");
          self._onMessage = value;
        },
        configurable: true
      },
      console: { value: console, configurable: true },
      
      // Deprecated use of on/postMessage from globals
      on: {
        value: function () {
          console.warn("The global `on()` function in content scripts is " +
                       "deprecated in favor of the `self.on()` function, " +
                       "which works the same. Replace calls to `on()` with " +
                       "calls to `self.on()`");
          publicAPI.on.apply(publicAPI, arguments);
        },
        configurable: true
      }, 
      postMessage: {
        value: function () {
          console.warn("The global `postMessage()` function in content " +
                       "scripts is deprecated in favor of the " +
                       "`self.postMessage()` function, which works the same. " +
                       "Replace calls to `postMessage()` with calls to " +
                       "`self.postMessage()`.");
          publicAPI.postMessage.apply(publicAPI, arguments);
        },
        configurable: true
      }
    });

    // The order of `contentScriptFile` and `contentScript` evaluation is
    // intentional, so programs can load libraries like jQuery from script URLs
    // and use them in scripts.
    let contentScriptFile = ('contentScriptFile' in worker) ? worker.contentScriptFile
          : null,
        contentScript = ('contentScript' in worker) ? worker.contentScript : null;

    if (contentScriptFile) {
      if (Array.isArray(contentScriptFile))
        this._importScripts.apply(this, contentScriptFile);
      else
        this._importScripts(contentScriptFile);
    }
    if (contentScript) {
      this._evaluate(
        Array.isArray(contentScript) ? contentScript.join(';\n') : contentScript
      );
    }
  },
  _destructor: function _destructor() {
    this._removeAllListeners();
    let publicAPI = this._public,
        sandbox = this._sandbox;
    delete sandbox.__proto__;
    for (let key in publicAPI)
      delete sandbox[key];
    this._sandbox = null;
    this._addonWorker = null;
    this.__onMessage = undefined;
  },
  
  /**
   * JavaScript sandbox where all the content scripts are evaluated.
   * {Sandbox}
   */
  _sandbox: null,
  
  /**
   * Reference to the addon side of the worker.
   * @type {Worker}
   */
  _addonWorker: null,
  
  /**
   * Evaluates code in the sandbox.
   * @param {String} code
   *    JavaScript source to evaluate.
   * @param {String} [filename='javascript:' + code]
   *    Name of the file
   */
  _evaluate: function(code, filename) {
    filename = filename || 'javascript:' + code;
    try {
      Cu.evalInSandbox(code, this._sandbox, JS_VERSION, filename, 1);
    }
    catch(e) {
      this._addonWorker._asyncEmit('error', e);
    }
  },
  /**
   * Imports scripts to the sandbox by reading files under urls and
   * evaluating its source. If exception occurs during evaluation
   * `"error"` event is emitted on the worker.
   * This is actually an analog to the `importScript` method in web
   * workers but in our case it's not exposed even though content
   * scripts may be able to do it synchronously since IO operation
   * takes place in the UI process.
   */
  _importScripts: function _importScripts(url) {
    let urls = Array.slice(arguments, 0);
    for each (let contentScriptFile in urls) {
      try {
        let filename = toFilename(contentScriptFile);
        this._evaluate(file.read(filename), filename);
      }
      catch(e) {
        this._addonWorker._asyncEmit('error', e)
      }
    }
  }
});

/**
 * Message-passing facility for communication between code running
 * in the content and add-on process.
 * @see https://jetpack.mozillalabs.com/sdk/latest/docs/#module/api-utils/content/worker
 */
const Worker = AsyncEventEmitter.compose({
  on: Trait.required,
  _asyncEmit: Trait.required,
  _removeAllListeners: Trait.required,
  
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
    if (!this._contentWorker)
      throw new Error(ERR_DESTROYED);
    this._contentWorker._asyncEmit('message',  JSON.parse(JSON.stringify(data)));
  },
  
  /**
   * EventEmitter, that behaves (calls listeners) asynchronously.
   * A way to send customized messages to / from the worker.
   * Events from in the worker can be observed / emitted via 
   * worker.on / worker.emit.
   */
  get port() {
    // We generate dynamically this attribute as it needs to be accessible
    // before Worker.constructor gets called. (For ex: Panel)
    
    // create an event emitter that receive and send events from/to the worker
    let self = this;
    this._port = EventEmitterTrait.create({
      emit: function () self._emitEventToContent(arguments)
    });
    // create emit that executes in next turn of event loop.
    this._port._asyncEmit = Enqueued(this._port._emit);
    // expose wrapped port, that exposes only public properties:
    // We need to destroy this getter in order to be able to set the
    // final value. We need to update only public port attribute as we never 
    // try to access port attribute from private API.
    delete this._public.port;
    this._public.port = Cortex(this._port);
    // Replicate public port to the private object
    delete this.port;
    this.port = this._public.port;
    
    return this._port;
  },
  
  /**
   * Same object than this.port but private API.
   * Allow access to _asyncEmit, in order to send event to port.
   */
  _port: null,
  
  /**
   * Emit a custom event to the content script, 
   * i.e. emit this event on `self.port`
   */
  _emitEventToContent: function _emitEventToContent(args) {
    // We need to save events that are emitted before the worker is 
    // initialized
    if (!this._inited) {
      this._earlyEvents.push(args);
      return;
    }
    
    // We throw exception when the worker has been destroyed
    if (!this._contentWorker) {
      throw new Error(ERR_DESTROYED);
    }
    
    let scope = this._contentWorker._port;
    // Ensure that we pass only JSON values
    scope._asyncEmit.apply(scope, ensureArgumentsAreJSON(args));
  },
  
  // Is worker connected to the content worker (i.e. WorkerGlobalScope) ?
  _inited: false,
  
  // List of custom events fired before worker is initialized
  get _earlyEvents() {
    delete this._earlyEvents;
    this._earlyEvents = [];
    return this._earlyEvents;
  },
  
  constructor: function Worker(options) {
    options = options || {};

    if ('window' in options)
      this._window = options.window;
    if ('contentScriptFile' in options)
      this.contentScriptFile = options.contentScriptFile;
    if ('contentScript' in options)
      this.contentScript = options.contentScript;
    if ('onError' in options)
      this.on('error', options.onError);
    if ('onMessage' in options)
      this.on('message', options.onMessage);
    if ('onDetach' in options)
      this.on('detach', options.onDetach);
    
    // Track document unload to destroy this worker.
    // We can't watch for unload event on page's window object as it 
    // prevents bfcache from working: 
    // https://developer.mozilla.org/En/Working_with_BFCache
    this._windowID = this._window.
                     QueryInterface(Ci.nsIInterfaceRequestor).
                     getInterface(Ci.nsIDOMWindowUtils).
                     currentInnerWindowID;
    observers.add("inner-window-destroyed", 
                  this._documentUnload = this._documentUnload.bind(this));
    
    unload.ensure(this._public, "destroy");
    
    // Ensure that worker._port is initialized for contentWorker to be able
    // to send use event during WorkerGlobalScope(this)
    this.port;
    
    // will set this._contentWorker pointing to the private API:
    WorkerGlobalScope(this);  
    
    // Mainly enable worker.port.emit to send event to the content worker
    this._inited = true;
    
    // Flush all events that have been fired before the worker is initialized.
    this._earlyEvents.forEach((function (args) this._emitEventToContent(args)).
                              bind(this));
  },
  
  _documentUnload: function _documentUnload(subject, topic, data) {
    let innerWinID = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
    if (innerWinID != this._windowID) return;
    this._workerCleanup();
  },

  get url() {
    return this._window.document.location.href;
  },
  
  get tab() {
    let tab = require("tabs/tab");
    return tab.getTabForWindow(this._window);
  },
  
  /**
   * Tells content worker to unload itself and 
   * removes all the references from itself.
   */
  destroy: function destroy() {
    this._workerCleanup();
    this._removeAllListeners('message');
    this._removeAllListeners('error');
    this._removeAllListeners('detach');
  },
  
  /**
   * Remove all internal references to the attached document
   * Tells _port to unload itself and removes all the references from itself.
   */
  _workerCleanup: function _workerCleanup() {
    // maybe unloaded before content side is created
    // As Symbiont call worker.constructor on document load
    if (this._contentWorker) 
      this._contentWorker._destructor();
    this._contentWorker = null;
    this._window = null;
    observers.remove("inner-window-destroyed", this._documentUnload);
    this._windowID = null;
    this._earlyEvents.slice(0, this._earlyEvents.length);
    this._emit("detach");
  },
  
  /**
   * Receive an event from the content script that need to be sent to 
   * worker.port. Provide a way for composed object to catch all events.
   */
  _onContentScriptEvent: function _onContentScriptEvent() {
    // Ensure that we pass only JSON values
    this._port._asyncEmit.apply(this._port, ensureArgumentsAreJSON(arguments));
  },
  
  /**
   * Reference to the content side of the worker.
   * @type {WorkerGlobalScope}
   */
  _contentWorker: null,

  /**
   * Reference to the window that is accessible from
   * the content scripts.
   * @type {Object}
   */
  _window: null,
});
exports.Worker = Worker;

