/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require("../core/heritage");
const { Disposable } = require("../core/disposable");
const { EventTarget } = require("../event/target");
const { emit, off } = require("../event/core");
const { Ci, Cu, Cc } = require('chrome');
const timer = require('../timers');
const { URL } = require('../url');
const events = require('../system/events');
const { sandbox, evaluate, load } = require("../loader/sandbox");
const { merge } = require('../util/object');
const xulApp = require("../system/xul-app");
const USE_JS_PROXIES = !xulApp.versionInRange(xulApp.platformVersion,
                                              "17.0a2", "*");
const { getTabForWindow } = require('../tabs/helpers');

/* Trick the linker in order to ensure shipping these files in the XPI.
  require('./content-proxy.js');
  require('./content-worker.js');
  Then, retrieve URL of these files in the XPI:
*/
let prefix = module.uri.split('worker.js')[0];
const CONTENT_PROXY_URL = prefix + 'content-proxy.js';
const CONTENT_WORKER_URL = prefix + 'content-worker.js';

const JS_VERSION = '1.8';

const ERR_DESTROYED =
  "Couldn't find the worker to receive this message. " +
  "The script may not be initialized yet, or may already have been unloaded.";

const ERR_FROZEN = "The page is currently hidden and can no longer be used " +
                   "until it is visible again.";

/**
 * This key is not exported and should only be used for proxy tests.
 * The following `PRIVATE_KEY` is used in addon module scope in order to tell
 * Worker API to expose `UNWRAP_ACCESS_KEY` in content script.
 * This key allows test-content-proxy.js to unwrap proxy with valueOf:
 *   let xpcWrapper = proxyWrapper.valueOf(UNWRAP_ACCESS_KEY);
 */
const PRIVATE_KEY = {};

function asyncEmit(worker, args) {
  // As `emit`, we ensure having an asynchronous behavior
  timer.setTimeout(function () {
    // We emit event to chrome/addon listeners
    var params = JSON.parse(args);
    params.unshift(worker);
    emit.apply(emit, params);
  }, 0);
}

const WorkerSandbox = Class({
  extends: EventTarget,
  implements: [Disposable],

  /**
   * Emit a message to the worker content sandbox
   */
  emitAsync: function emitAsync() {
    // First ensure having a regular array
    // (otherwise, `arguments` would be mapped to an object by `stringify`)
    let array = Array.slice(arguments);
    // JSON.stringify is buggy with cross-sandbox values,
    // it may return "{}" on functions. Use a replacer to match them correctly.
    function replacer(k, v) {
      return typeof v === "function" ? undefined : v;
    }
    timer.setTimeout(function (self) {
      self._emitToContent(JSON.stringify(array, replacer));
    }, 0, this);
  },

  /**
   * Synchronous version of `emit`.
   * /!\ Should only be used when it is strictly mandatory /!\
   *     Doesn't ensure passing only JSON values.
   *     Mainly used by context-menu in order to avoid breaking it.
   */
  emitSync: function emitSync() {
    let args = Array.slice(arguments);
    // Bug 732716: Ensure wrapping xrays sent to the content script
    // otherwise it will have access to raw xraywrappers and content script
    // will assume it is an user object coming from the content script sandbox
    if (this._wrap)
      args = args.map(this._wrap);
    return this._emitToContent(args);
  },
  _emitToContent: null,

  /**
   * Tells if content script has at least one listener registered for one event,
   * through `self.on('xxx', ...)`.
   * /!\ Shouldn't be used. Implemented to avoid breaking context-menu API.
   */
  hasListenerFor: function hasListenerFor(name) {
    return this._hasListenerFor(name);
  },
  _hasListenerFor: null,

  /**
   * Configures sandbox and loads content scripts into it.
   * @param {Worker} worker
   *    content worker
   */
  setup: function setup(worker) {
    this._addonWorker = worker;

    // Ensure that `emit` has always the right `this`
    this.emit = this.emitAsync.bind(this);

    // We receive a wrapped window, that may be an xraywrapper if it's content
    let window = worker._window;
    let proto = window;

    // Instantiate trusted code in another Sandbox in order to prevent content
    // script from messing with standard classes used by proxy and API code.
    let apiSandbox = sandbox(window, { wantXrays: true });

    // Build content proxies only if the document has a non-system principal
    // And only on old firefox versions that doesn't ship bug 738244
    if (USE_JS_PROXIES && XPCNativeWrapper.unwrap(window) !== window) {
      apiSandbox.console = console;
      // Execute the proxy code
      load(apiSandbox, CONTENT_PROXY_URL);
      // Get a reference of the window's proxy
      proto = apiSandbox.create(window);
      // Keep a reference to `wrap` function for `emitSync` usage
      this._wrap = apiSandbox.wrap;
    }

    // Create the sandbox and bind it to window in order for content scripts to
    // have access to all standard globals (window, document, ...)
    let content = this._sandbox = sandbox(window, {
      sandboxPrototype: proto,
      wantXrays: true
    });
    // We have to ensure that window.top and window.parent are the exact same
    // object than window object, i.e. the sandbox global object. But not
    // always, in case of iframes, top and parent are another window object.
    let top = window.top === window ? content : content.top;
    let parent = window.parent === window ? content : content.parent;
    merge(content, {
      // We need "this === window === top" to be true in toplevel scope:
      get window() content,
      get top() top,
      get parent() parent,
      // Use the Greasemonkey naming convention to provide access to the
      // unwrapped window object so the content script can access document
      // JavaScript values.
      // NOTE: this functionality is experimental and may change or go away
      // at any time!
      get unsafeWindow() window.wrappedJSObject
    });

    // Load trusted code that will inject content script API.
    // We need to expose JS objects defined in same principal in order to
    // avoid having any kind of wrapper.
    load(apiSandbox, CONTENT_WORKER_URL);

    // prepare a clean `self.options`
    let options = 'contentScriptOptions' in worker ?
      JSON.stringify( worker.contentScriptOptions ) :
      undefined;

    // Then call `inject` method and communicate with this script
    // by trading two methods that allow to send events to the other side:
    //   - `onEvent` called by content script
    //   - `result.emitToContent` called by addon script
    // Bug 758203: We have to explicitely define `__exposedProps__` in order
    // to allow access to these chrome object attributes from this sandbox with
    // content priviledges
    // https://developer.mozilla.org/en/XPConnect_wrappers#Other_security_wrappers
    let chromeAPI = {
      timers: {
        setTimeout: timer.setTimeout,
        setInterval: timer.setInterval,
        clearTimeout: timer.clearTimeout,
        clearInterval: timer.clearInterval,
        __exposedProps__: {
          setTimeout: 'r',
          setInterval: 'r',
          clearTimeout: 'r',
          clearInterval: 'r'
        }
      },
      __exposedProps__: {
        timers: 'r'
      }
    };
    let onEvent = asyncEmit.bind(this, this);
    // `ContentWorker` is defined in CONTENT_WORKER_URL file
    let result = apiSandbox.ContentWorker.inject(content, chromeAPI, onEvent, options);
    this._emitToContent = result.emitToContent;
    this._hasListenerFor = result.hasListenerFor;

    // Handle messages send by this script:
    let self = this;
    // console.xxx calls
    this.on("console", function consoleListener(kind) {
      console[kind].apply(console, Array.slice(arguments, 1));
    });

    // self.postMessage calls
    this.on("message", function postMessage(data) {
      // destroyed?
      let port = self._addonWorker
      if (port) emit(port, "message", data)
    });

    // self.port.emit calls
    this.on("event", function portEmit(name, args) {
      // destroyed?
      if (self._addonWorker)
        self._addonWorker._onContentScriptEvent.apply(self._addonWorker, arguments);
    });

    // Internal feature that is only used by SDK tests:
    // Expose unlock key to content script context.
    // See `PRIVATE_KEY` definition for more information.
    if (apiSandbox && worker._expose_key)
      content.UNWRAP_ACCESS_KEY = apiSandbox.UNWRAP_ACCESS_KEY;

    // Inject `addon` global into target document if document is trusted,
    // `addon` in document is equivalent to `self` in content script.
    if (worker._injectInDocument) {
      let win = window.wrappedJSObject ? window.wrappedJSObject : window;
      Object.defineProperty(win, "addon", {
          value: content.self
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
  dispose: function destroy() {
    this.emitSync("detach");
    this._sandbox = null;
    this._addonWorker = null;
    this._wrap = null;
  },

  _wrap: null,

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
    catch(error) {
      emit(this._addonWorker, "error", error)
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
      catch(error) {
        emit(this._addonWorker, "error", error)
      }
    }
  }
});

function onDocumentUnload(worker, event) {
    let innerWinID = event.subject.QueryInterface(Ci.nsISupportsPRUint64).data;
    if (innerWinID != worker._windowID) return false;
    worker._workerCleanup();
    return true;
}

function pageShow(worker) {
  worker._contentWorker.emitSync("pageshow");
  emit(worker, "pageshow")
  worker._frozen = false;
}

function pageHide(worker) {
  worker._contentWorker.emitSync("pagehide");
  emit(worker, "pagehide")
  worker._frozen = true;
}

/**
 * Message-passing facility for communication between code running
 * in the content and add-on process.
 * @see https://jetpack.mozillalabs.com/sdk/latest/docs/#module/api-utils/content/worker
 */
const Worker = Class({
  implements: [Disposable],
  extends: EventTarget,
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
    if (this._frozen)
      throw new Error(ERR_FROZEN);

    this._contentWorker.emit("message", data);
  },

  /**
   * EventEmitter, that behaves (calls listeners) asynchronously.
   * A way to send customized messages to / from the worker.
   * Events from in the worker can be observed / emitted via
   * worker.on / worker.emit.
   */
  get port() {
    return this._port;
  },

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

    if (this._frozen)
      throw new Error(ERR_FROZEN);

    // We throw exception when the worker has been destroyed
    if (!this._contentWorker) {
      throw new Error(ERR_DESTROYED);
    }

    // Forward the event to the WorkerSandbox object
    this._contentWorker.emit.apply(null, ["event"].concat(args));
  },

 // Is worker connected to the content worker sandbox ?
  _inited: false,

  // Is worker being frozen? i.e related document is frozen in bfcache.
  // Content script should not be reachable if frozen.
  _frozen: true,

  setupPort: function setupPort() {
    if (this.port) return;
    // Ensure that worker._port is initialized for contentWorker to be able
    // to send use event during WorkerSandbox(this)
    let port = EventTarget();
    port.emit = function emit() {
      this._emitEventToContent(Array.slice(arguments));
    }.bind(this);
    this._port = port;
    this._earlyEvents = [];
  },

  _port: null,
  _earlyEvents: null,

  setup: function initialize(options) {
    options = options || {};

    if ('window' in options)
      this._window = options.window;
    if ('contentScriptFile' in options)
      this.contentScriptFile = options.contentScriptFile;
    if ('contentScriptOptions' in options)
      this.contentScriptOptions = options.contentScriptOptions;
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
    events.on("inner-window-destroyed",
                  this._documentUnload = onDocumentUnload.bind(this, this));

    // Listen to pagehide event in order to freeze the content script
    // while the document is frozen in bfcache:
    this._window.addEventListener("pageshow",
                                  this._pageShow = pageShow.bind(this, this),
                                  true);
    this._window.addEventListener("pagehide",
                                  this._pageHide = pageHide.bind(this, this),
                                  true);

    this.setupPort();

    // will set this._contentWorker pointing to the private API:
    this._contentWorker = WorkerSandbox(this);

    // Mainly enable worker.port.emit to send event to the content worker
    this._inited = true;
    this._frozen = false;

    // Flush all events that have been fired before the worker is initialized.
    this._earlyEvents.forEach(this._emitEventToContent, this);
  },
  _expose_key: false,
  _windowID: null,


  get url() {
    // this._window will be null after detach
    return this._window ? this._window.document.location.href : null;
  },

  get tab() {
    // this._window will be null after detach
    if (this._window)
      return getTabForWindow(this._window);
    return null;
  },

  /**
   * Tells content worker to unload itself and
   * removes all the references from itself.
   */
  dispose: function dispose() {
    this._workerCleanup();
    off(this);
  },

  /**
   * Remove all internal references to the attached document
   * Tells _port to unload itself and removes all the references from itself.
   */
  _workerCleanup: function _workerCleanup() {
    // maybe unloaded before content side is created
    // As Symbiont call worker.constructor on document load
    if (this._contentWorker)
      this._contentWorker.destroy();
    this._contentWorker = null;
    if (this._window) {
      this._window.removeEventListener("pageshow", this._pageShow, true);
      this._window.removeEventListener("pagehide", this._pageHide, true);
    }
    this._window = null;
    // This method may be called multiple times,
    // avoid dispatching `detach` event more than once
    if (this._windowID) {
      this._windowID = null;
      events.off("inner-window-destroyed", this._documentUnload);
      this._earlyEvents.slice(0, this._earlyEvents.length);
      emit(this, "detach");
    }
  },

  /**
   * Receive an event from the content script that need to be sent to
   * worker.port. Provide a way for composed object to catch all events.
   */
  _onContentScriptEvent: function _onContentScriptEvent() {
    emit.apply(emit, [this.port].concat(Array.slice(arguments)));
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
