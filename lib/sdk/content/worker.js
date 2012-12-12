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
const { ns } = require("../core/namespace");
const { EventTarget } = require("../event/target");
const { emit, on, off, setListeners } = require("../event/core");
const { Port, connect, disconnect, pause,
        resume, flush, isPaused } = require("./port");
const { Ci } = require('chrome');
const timer = require('../timers');
const { URL } = require('../url');
const events = require('../system/events');
const { sandbox, evaluate, load } = require("../loader/sandbox");
const { merge } = require('../util/object');
const xulApp = require("../system/xul-app");
const { method, defer } = require("../lang/functional");
const USE_JS_PROXIES = !xulApp.versionInRange(xulApp.platformVersion,
                                              "17.0a2", "*");
const { getTabForWindow } = require('../tabs/helpers');
const { contentUnload } = require("./states");
const { getInnerId } = require('../window/utils');

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

//  Emit that emits events in a next tick.
var emitAsync = defer(emit);

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
  setup: function setup(addonPort) {
    this._addonWorker = addonPort;
    let { model, view } = worker(addonPort);

    // Ensure that `emit` has always the right `this`
    this.emit = this.emitAsync.bind(this);

    // We receive a wrapped window, that may be an xraywrapper if it's content
    let window = view;
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
    let options = 'contentScriptOptions' in model ?
      JSON.stringify( model.contentScriptOptions ) :
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

    let self = this;
    function onEvent(message) {
      try {
        let event = JSON.parse(message);
        event.unshift(self._addonWorker.port);
        emitAsync.apply(emitAsync, event);
      } catch (error) {
        emit(port, "error", error);
      }
    }

    // `ContentWorker` is defined in CONTENT_WORKER_URL file
    let result = apiSandbox.ContentWorker.inject(content, chromeAPI, options, onEvent);
    this._emitToContent = result.emitToContent;
    this._hasListenerFor = result.hasListenerFor;

    // Internal feature that is only used by SDK tests:
    // Expose unlock key to content script context.
    // See `PRIVATE_KEY` definition for more information.
    if (apiSandbox && model.expose_key)
      content.UNWRAP_ACCESS_KEY = apiSandbox.UNWRAP_ACCESS_KEY;

    // Inject `addon` global into target document if document is trusted,
    // `addon` in document is equivalent to `self` in content script.
    if (model.injectInDocument) {
      let win = window.wrappedJSObject ? window.wrappedJSObject : window;
      Object.defineProperty(win, "addon", {
          value: content.self
        }
      );
    }

    // The order of `contentScriptFile` and `contentScript` evaluation is
    // intentional, so programs can load libraries like jQuery from script URLs
    // and use them in scripts.
    let contentScriptFile = ('contentScriptFile' in model) ? model.contentScriptFile
          : null,
        contentScript = ('contentScript' in model) ? model.contentScript : null;

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

function onPageShow(instance) {
  return function pageShow() {
    let { contentWorker, model } = worker(instance);
    resume(instance.port);
    contentWorker.emitSync("pageshow");
    emit(instance, "pageshow");
  }
}

function onPageHide(instance) {
  return function pageHide() {
    let { contentWorker, model } = worker(instance);
    pause(instance.port);
    contentWorker.emitSync("pagehide");
    emit(instance, "pagehide")
  }
}

let worker = ns();

/**
 * Receive an event from the content script that need to be sent to
 * worker.port. Provide a way for composed object to catch all events.
 */
function emitEventToWorker(workerInstance, args) {
  emit.apply(emit, [workerInstance.port].concat(Array.slice(args)))
}

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
      contentWorker.destroy();
      internal.contentWorker = null;
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
  let contentWorker = WorkerSandbox(instance);
  internal.contentWorker = contentWorker;

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
    expose_key: false,
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
    model.expose_key = true;

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
