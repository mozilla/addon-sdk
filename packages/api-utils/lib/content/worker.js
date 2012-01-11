/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Trait } = require('../traits');
const { EventEmitter, EventEmitterTrait } = require('../events');
const { Ci, Cu, Cc } = require('chrome');
const timer = require('../timer');
const { URL } = require('../url');
const unload = require('../unload');
const observers = require('../observer-service');
const { Cortex } = require('../cortex');
const { Enqueued } = require('../utils/function');
const self = require("self");
const { sandbox, evaluate, load } = require("../sandbox");
const { merge } = require('../utils/object');

const CONTENT_PROXY_URL = self.data.url("content-proxy.js");

const JS_VERSION = '1.8';

const ERR_DESTROYED =
  "The page has been destroyed and can no longer be used.";

/**
 * This key is not exported and should only be used for proxy tests.
 * The following `PRIVATE_KEY` is used in addon module scope in order to tell
 * Worker API to expose `UNWRAP_ACCESS_KEY` in content script.
 * This key allows test-content-proxy.js to unwrap proxy with valueOf:
 *   let xpcWrapper = proxyWrapper.valueOf(UNWRAP_ACCESS_KEY);
 */
const PRIVATE_KEY = {};

function ensureArgumentsAreJSON(array, window) {
  // JSON.stringify is buggy with cross-sandbox values,
  // it may return "{}" on functions. Use a replacer to match them correctly.
  function replacer(k, v) {
    return typeof v === "function" ? undefined : v;
  }
  // If a window is given, we use its `JSON.parse` object in order to
  // create JS objects for its compartments (See bug 714891)
  let parse = JSON.parse;
  if (window) {
    // As we can't directly rely on `window.wrappedJSObject.JSON`, we create
    // a temporary sandbox in order to get access to a safe `JSON` object:
    parse = Cu.Sandbox(window).JSON.parse;
  }
  return parse(JSON.stringify(array, replacer));
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

  // List of all living timeouts/intervals
  _timers: null,

  setTimeout: function setTimeout(callback, delay) {
    let params = Array.slice(arguments, 2);
    let id = timer.setTimeout(function(self) {
      try {
        delete self._timers[id];
        callback.apply(null, params);
      } catch(e) {
        self._addonWorker._asyncEmit('error', e);
      }
    }, delay, this);
    this._timers[id] = true;
    return id;
  },
  clearTimeout: function clearTimeout(id){
    delete this._timers[id];
    return timer.clearTimeout(id);
  },

  setInterval: function setInterval(callback, delay) {
    let params = Array.slice(arguments, 2);
    let id = timer.setInterval(function(self) {
      try {
        callback.apply(null, params); 
      } catch(e) {
        self._addonWorker._asyncEmit('error', e);
      }
    }, delay, this);
    this._timers[id] = true;
    return id;
  },
  clearInterval: function clearInterval(id) {
    delete this._timers[id];
    return timer.clearInterval(id);
  },

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
    this._addonWorker._asyncEmit('message', ensureArgumentsAreJSON(data));
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
    
    let proto = window;
    let proxySandbox = null;
    // Build content proxies only if the document has a non-system principal
    if (window.wrappedJSObject) {
      // Instantiate the proxy code in another Sandbox in order to prevent
      // content script from polluting globals used by proxy code
      proxySandbox = sandbox(window, { wantXrays: true });
      proxySandbox.console = console;
      // Execute the proxy code
      load(proxySandbox, CONTENT_PROXY_URL);
      // Get a reference of the window's proxy
      proto = proxySandbox.create(window);
    }

    // Create the sandbox and bind it to window in order for content scripts to
    // have access to all standard globals (window, document, ...)
    let content = this._sandbox = sandbox(window, {
      sandboxPrototype: proto,
      wantXrays: true
    });
    merge(content, {
      // We need "this === window === top" to be true in toplevel scope:
      get window() content,
      get top() content,
      // Use the Greasemonkey naming convention to provide access to the
      // unwrapped window object so the content script can access document
      // JavaScript values.
      // NOTE: this functionality is experimental and may change or go away
      // at any time!
      get unsafeWindow() window.wrappedJSObject
    });

    // Internal feature that is only used by SDK tests:
    // Expose unlock key to content script context.
    // See `PRIVATE_KEY` definition for more information.
    if (proxySandbox && worker._expose_key)
      content.UNWRAP_ACCESS_KEY = proxySandbox.UNWRAP_ACCESS_KEY;

    // Initialize timer lists
    this._timers = {};

    let self = this;
    let publicAPI = this._public;

    merge(content, {
      console: console,
      self: publicAPI.self,
      setTimeout: publicAPI.setTimeout,
      clearTimeout: publicAPI.clearTimeout,
      setInterval: publicAPI.setInterval,
      clearInterval: publicAPI.clearInterval,
      get onMessage() self._onMessage,
      set onMessage(value) {
        console.warn("The global `onMessage` function in content scripts " +
                     "is deprecated in favor of the `self.on()` function. " +
                     "Replace `onMessage = function (data){}` definitions " +
                     "with calls to `self.on('message', function (data){})`. " +
                     "For more info on `self.on`, see " +
                     "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        self._onMessage = value;
      },
      // Deprecated use of on/postMessage from globals
      postMessage: function postMessage() {
        console.warn("The global `postMessage()` function in content " +
                     "scripts is deprecated in favor of the " +
                     "`self.postMessage()` function, which works the same. " +
                     "Replace calls to `postMessage()` with calls to " +
                     "`self.postMessage()`." +
                     "For more info on `self.on`, see " +
                     "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        publicAPI.postMessage.apply(publicAPI, arguments);
      },
      on: function on() {
        console.warn("The global `on()` function in content scripts is " +
                     "deprecated in favor of the `self.on()` function, " +
                     "which works the same. Replace calls to `on()` with " +
                     "calls to `self.on()`" +
                     "For more info on `self.on`, see " +
                     "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        publicAPI.on.apply(publicAPI, arguments);
      }
    });

    // Temporary fix for test-widget, that pass self.postMessage to proxy code
    // that first try to access to `___proxy` and then call it through `apply`.
    // We need to move function given to content script to a sandbox
    // with same principal than the content script.
    // In the meantime, we need to allow such access explicitly
    // by using `__exposedProps__` property, documented here:
    // https://developer.mozilla.org/en/XPConnect_wrappers
    content.self.postMessage.__exposedProps__ = {
      ___proxy: 'rw',
      apply: 'rw'
    }

    // Inject `addon` global into target document if document is trusted,
    // `addon` in document is equivalent to `self` in content script.
    if (worker._injectInDocument) {
      let win = window.wrappedJSObject ? window.wrappedJSObject : window;
      Object.defineProperty(win, "addon", {
          get: function () publicAPI
        }
      );
    }

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
    // Unregister all setTimeout/setInterval
    // We can use `clearTimeout` for both setTimeout/setInterval
    // as internal implementation of timer module use same method for both.
    for (let id in this._timers)
      timer.clearTimeout(id);
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
    try {
      evaluate(this._sandbox, code, filename || 'javascript:' + code);
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
        let uri = URL(contentScriptFile);
        if (uri.scheme === 'resource')
          load(this._sandbox, String(uri));
        else
          throw Error("Unsupported `contentScriptFile` url: " + String(uri));
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
    this._contentWorker._asyncEmit('message',
                                   ensureArgumentsAreJSON(data, this._window));
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
    let array = Array.prototype.slice.call(args);
    scope._asyncEmit.apply(scope, ensureArgumentsAreJSON(array, this._window));
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

    // Internal feature that is only used by SDK unit tests.
    // See `PRIVATE_KEY` definition for more information.
    if ('exposeUnlockKey' in options && options.exposeUnlockKey === PRIVATE_KEY)
      this._expose_key = true;

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
    if (innerWinID != this._windowID) return false;
    this._workerCleanup();
    return true;
  },

  get url() {
    // this._window will be null after detach
    return this._window ? this._window.document.location.href : null;
  },
  
  get tab() {
    if (this._window) {
      let tab = require("../tabs/tab");
      // this._window will be null after detach
      return tab.getTabForWindow(this._window);
    }
    return null;
  },
  
  /**
   * Tells content worker to unload itself and 
   * removes all the references from itself.
   */
  destroy: function destroy() {
    this._workerCleanup();
    this._removeAllListeners();
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
    // This method may be called multiple times,
    // avoid dispatching `detach` event more than once
    if (this._windowID) {
      this._windowID = null;
      observers.remove("inner-window-destroyed", this._documentUnload);
      this._earlyEvents.slice(0, this._earlyEvents.length);
      this._emit("detach");
    }
  },
  
  /**
   * Receive an event from the content script that need to be sent to 
   * worker.port. Provide a way for composed object to catch all events.
   */
  _onContentScriptEvent: function _onContentScriptEvent() {
    // Ensure that we pass only JSON values
    let array = Array.prototype.slice.call(arguments);
    this._port._asyncEmit.apply(this._port, ensureArgumentsAreJSON(array));
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

  /**
   * Flag to enable `addon` object injection in document. (bug 612726)
   * @type {Boolean}
   */
  _injectInDocument: false
});
exports.Worker = Worker;
