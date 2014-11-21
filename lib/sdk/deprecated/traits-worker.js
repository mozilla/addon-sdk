/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 *
 * `deprecated/traits-worker` was previously `content/worker` and kept
 * only due to `deprecated/symbiont` using it, which is necessary for
 * `widget`, until that reaches deprecation EOL.
 *
 */

"use strict";

module.metadata = {
  "stability": "deprecated"
};

const { Class } = require('../core/heritage');
const { Disposable } = require('../core/disposable');
const { Bond } = require('../util/bond');
const { EventTarget } = require('../event/target');
const { emit, setListeners, off } = require('../event/core');
const { Ci, Cu, Cc } = require('chrome');
const timer = require('../timers');
const { URL } = require('../url');
const observers = require('../system/events');
const { sandbox: Sandbox, evaluate: evalInSandbox, load } = require("../loader/sandbox");
const { merge } = require('../util/object');
const { getInnerId } = require("../window/utils");
const { getTabForWindow } = require('../tabs/helpers');
const { getTabForContentWindow } = require('../tabs/utils');

/* Trick the linker in order to ensure shipping these files in the XPI.
  require('../content/content-worker.js');
  Then, retrieve URL of these files in the XPI:
*/
const CONTENT_WORKER_URL = require.resolve('../content/content-worker');

// Fetch additional list of domains to authorize access to for each content
// script. It is stored in manifest `metadata` field which contains
// package.json data. This list is originaly defined by authors in
// `permissions` attribute of their package.json addon file.
const permissions = require('@loader/options').metadata['permissions'] || {};
const EXPANDED_PRINCIPALS = permissions['cross-domain-content'] || [];

const JS_VERSION = '1.8';

const ERR_DESTROYED =
  "Couldn't find the worker to receive this message. " +
  "The script may not be initialized yet, or may already have been unloaded.";

const ERR_FROZEN = "The page is currently hidden and can no longer be used " +
                   "until it is visible again.";


// JSON.stringify is buggy with cross-sandbox values,
// it may return "{}" on functions. This utility replacer will help
// avoid that broken behavior.
const functionDrop = (_, x) => typeof(x) === "function" ? void(0) : x;

// private interface
const emitToContent = Symbol("worker-sandbox/emit-to-content");
const onContentEvent = Symbol("worker-sandbox/on-content-event");
const injectInDocument = Symbol("injectInDocument");
const sandbox = Symbol("worker-sandbox/sandbox");

const addonWorker = Symbol("addon-worker");
const target = Symbol("worker/target");
const onContentScriptEvent = Symbol();
const importScripts = Symbol();
const evaluate = Symbol();

const WorkerSandbox = Class({
  implements: [
    EventTarget,
    Bond({
      /**
       * Emit a message to the worker content sandbox
       */
      emit(...args) {
        timer.setTimeout(() => {
          this[emitToContent](JSON.stringify(args, functionDrop));
        }, 0);
      },

      /**
       * Synchronous version of `emit`.
       * /!\ Should only be used when it is strictly mandatory /!\
       *     Doesn't ensure passing only JSON values.
       *     Mainly used by context-menu in order to avoid breaking it.
       */
      emitSync(...args) {
        return this[emitToContent](Cu.cloneInto(args, this[addonWorker][target]));
      },

      /**
       * Method called by the worker sandbox when it needs to send a message
       */
      [onContentEvent](args) {
        // As `emit`, we ensure having an asynchronous behavior
        timer.setTimeout(() => {
          // We emit event to chrome/addon listeners
          emit(this, ...JSON.parse(args));
        }, 0);
      }
    })
  ],
  /**
   * Configures sandbox and loads content scripts into it.
   * @param {Worker} worker
   *    content worker
   */
  initialize(worker) {
    this[addonWorker] = worker;

    // We receive a wrapped window, that may be an xraywrapper if it's content
    let window = worker[target];
    let proto = window;

    // Eventually use expanded principal sandbox feature, if some are given.
    //
    // But prevent it when the Worker isn't used for a content script but for
    // injecting `addon` object into a Panel, Widget, ... scope.
    // That's because:
    // 1/ It is useless to use multiple domains as the worker is only used
    // to communicate with the addon,
    // 2/ By using it it would prevent the document to have access to any JS
    // value of the worker. As JS values coming from multiple domain principals
    // can't be accessed by "mono-principals" (principal with only one domain).
    // Even if this principal is for a domain that is specified in the multiple
    // domain principal.
    let principals = window;
    let wantGlobalProperties = []
    if (EXPANDED_PRINCIPALS.length > 0 && !worker[injectInDocument]) {
      principals = EXPANDED_PRINCIPALS.concat(window);
      // We have to replace XHR constructor of the content document
      // with a custom cross origin one, automagically added by platform code:
      delete proto.XMLHttpRequest;
      wantGlobalProperties.push("XMLHttpRequest");
    }

    // Create the sandbox and bind it to window in order for content scripts to
    // have access to all standard globals (window, document, ...)
    let content = this[sandbox] = Sandbox(principals, {
      sandboxPrototype: proto,
      wantXrays: !worker[injectInDocument],
      wantGlobalProperties: wantGlobalProperties,
      sameZoneAs: window,
      metadata: {
        SDKContentScript: true,
        'inner-window-id': getInnerId(window)
      }
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
      get parent() parent
    });

    // Use the Greasemonkey naming convention to provide access to the
    // unwrapped window object so the content script can access document
    // JavaScript values.
    // NOTE: this functionality is experimental and may change or go away
    // at any time!
    //
    // Note that because waivers aren't propagated between origins, we
    // need the unsafeWindow getter to live in the sandbox.
    var unsafeWindowGetter =
      new content.Function('return window.wrappedJSObject || window;');
    Object.defineProperty(content, 'unsafeWindow', {get: unsafeWindowGetter});


    // Load trusted code that will inject content script API.
    let ContentWorker = load(content, CONTENT_WORKER_URL);

    // prepare a clean `self.options`
    let options = 'contentScriptOptions' in worker ?
      JSON.stringify( worker.contentScriptOptions ) :
      undefined;

    // Then call `inject` method and communicate with this script
    // by trading two methods that allow to send events to the other side:
    //   - `onEvent` called by content script
    //   - `result.emitToContent` called by addon script
    let chromeAPI = Cu.cloneInto({
      timers: {
        setTimeout: timer.setTimeout.bind(timer),
        setInterval: timer.setInterval.bind(timer),
        clearTimeout: timer.clearTimeout.bind(timer),
        clearInterval: timer.clearInterval.bind(timer),
      },
      sandbox: {
        evaluate: evalInSandbox,
      },
    }, ContentWorker, {cloneFunctions: true});
    let onEvent = Cu.exportFunction(this[onContentEvent], ContentWorker);
    let result = Cu.waiveXrays(ContentWorker).inject(content, chromeAPI, onEvent, options);
    this[emitToContent] = result;

    // Handle messages send by this script:
    // console.xxx calls
    this.on("console", (kind, ...etc) => console[kind](...etc));

    // self.postMessage calls
    this.on("message", data => {
      // destroyed?
      if (this[addonWorker]) {
        emit(this[addonWorker], 'message', data);
      }
    });

    // self.port.emit calls
    this.on("event", (name, ...etc) => {
      // destroyed?
      if (this[addonWorker]) {
        this[addonWorker][onContentScriptEvent](name, ...ect);
      }
    });

    // unwrap, recreate and propagate async Errors thrown from content-script
    this.on("error", ({instanceOfError, value}) => {
      if (this[addonWorker]) {
        let error = value;
        if (instanceOfError) {
          error = new Error(value.message, value.fileName, value.lineNumber);
          error.stack = value.stack;
          error.name = value.name;
        }
        emit(this[addonWorker], 'error', error);
      }
    });

    // Inject `addon` global into target document if document is trusted,
    // `addon` in document is equivalent to `self` in content script.
    if (worker[injectInDocument]) {
      let win = window.wrappedJSObject ? window.wrappedJSObject : window;
      Object.defineProperty(win, "addon", {
          value: content.self
        }
      );
    }

    // Inject our `console` into target document if worker doesn't have a tab
    // (e.g Panel, PageWorker, Widget).
    // `worker.tab` can't be used because bug 804935.
    if (!getTabForContentWindow(window)) {
      let win = window.wrappedJSObject ? window.wrappedJSObject : window;

      // export our chrome console to content window as described here:
      // https://developer.mozilla.org/en-US/docs/Components.utils.createObjectIn
      let con = Cu.createObjectIn(win);

      let genPropDesc = function genPropDesc(fun) {
        return { enumerable: true, configurable: true, writable: true,
          value: console[fun] };
      }

      const properties = {
        log: genPropDesc('log'),
        info: genPropDesc('info'),
        warn: genPropDesc('warn'),
        error: genPropDesc('error'),
        debug: genPropDesc('debug'),
        trace: genPropDesc('trace'),
        dir: genPropDesc('dir'),
        group: genPropDesc('group'),
        groupCollapsed: genPropDesc('groupCollapsed'),
        groupEnd: genPropDesc('groupEnd'),
        time: genPropDesc('time'),
        timeEnd: genPropDesc('timeEnd'),
        profile: genPropDesc('profile'),
        profileEnd: genPropDesc('profileEnd'),
       __noSuchMethod__: { enumerable: true, configurable: true, writable: true,
                            value: function() {} }
      };

      Object.defineProperties(con, properties);
      Cu.makeObjectPropsNormal(con);

      win.console = con;
    };

    // The order of `contentScriptFile` and `contentScript` evaluation is
    // intentional, so programs can load libraries like jQuery from script URLs
    // and use them in scripts.
    let contentScriptFile = ('contentScriptFile' in worker) ? worker.contentScriptFile
          : null,
        contentScript = ('contentScript' in worker) ? worker.contentScript : null;

    if (contentScriptFile) {
      if (Array.isArray(contentScriptFile))
        this[importScripts](...contentScriptFile);
      else
        this[importScripts](contentScriptFile);
    }
    if (contentScript) {
      this[evaluate](
        Array.isArray(contentScript) ? contentScript.join(';\n') : contentScript
      );
    }
  },
  destroy: function destroy() {
    this.emitSync("detach");
    this[sandbox] = null;
    this[addonWorker] = null;
  },

  /**
   * JavaScript sandbox where all the content scripts are evaluated.
   * {Sandbox}
   */
  [sandbox]: null,

  /**
   * Reference to the addon side of the worker.
   * @type {Worker}
   */
  [addonWorker]: null,

  /**
   * Evaluates code in the sandbox.
   * @param {String} code
   *    JavaScript source to evaluate.
   * @param {String} [filename='javascript:' + code]
   *    Name of the file
   */
  [evaluate](code, filename) {
    try {
      evalInSandbox(this[sandbox], code, filename || 'javascript:' + code);
    }
    catch(e) {
      emit(this[addonWorker], 'error', e);
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
  [importScripts](...urls) {
    for (let contentScriptFile of urls) {
      try {
        let uri = URL(contentScriptFile);
        if (uri.scheme === 'resource')
          load(this[sandbox], String(uri));
        else
          throw Error("Unsupported `contentScriptFile` url: " + String(uri));
      }
      catch(e) {
        emit(this[addonWorker], 'error', e);
      }
    }
  }
});

// private interface
const scheduledEvents = Symbol("worker/scheduled-events");
const inited = Symbol("worker/inited");
const port = Symbol("worker/port");
const emitEventToContent = Symbol("worker/emit-to-content");
const frozen = Symbol("worker/frozen");
const onDocumentUnload = Symbol("worker/onDocumentUnload");
const onPageShow = Symbol("worker/onPageShow");
const onPageHide = Symbol("worker/onPageHide");
const attach = Symbol("worker/attach");
const windowID = Symbol("worker/window-id");
const contentWorker = Symbol("worker/content-worker");
const workerCleanup = Symbol("wroker/cleanup");
const dispatchEvent = Symbol("worker/dispatch-event");
const scheduleEvent = Symbol("worker/schedule-event");
const portOwner = Symbol("worker/port/owner");

const WorkerPort = Class({
  implements: [EventTarget],
  emit(type, ...args) {
    this[portOwner][emitEventToContent](type, ...args);
  },
  initialize(owner) {
    this[portOwner] = owner;
  }
});

/**
 * Message-passing facility for communication between code running
 * in the content and add-on process.
 * @see https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/content_worker
 */
const Worker = Class({
  implements: [
    Disposable,
    EventTarget,
    Bond({
      [onDocumentUnload](event) {
        const { topic, subject, data } = event;
        let innerWinID = subject.QueryInterface(Ci.nsISupportsPRUint64).data;
        if (innerWinID !== this[windowID]) {
          return false;
        } else {
          this[workerCleanup]();
          return true;
        }
      },

      [onPageShow](event) {
        this[contentWorker].emitSync("pageshow");
        emit(this, "pageshow");
        this[frozen] = false;
      },

      [onPageHide]() {
        this[contentWorker].emitSync("pagehide");
        emit(this, "pagehide");
        this[frozen] = true;
      }
    })
  ],

  // Queue of events fired before worker was initialized
  get [scheduledEvents]() {
    Object.defineProperty(this, scheduledEvents, { value: [] });

    return this[scheduledEvents];
  },

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
  postMessage: function (...args) {
    this[scheduleEvent]("message", ...args);
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
    Object.defineProperty(this, "port", {
      // create an event emitter that receive and send events from/to the worker
      value: new WorkerPort(this)
    });

    return this.port;
  },
  /**
   * Emit a custom event to the content script,
   * i.e. emit this event on `self.port`
   */
  [emitEventToContent](...args) {
    this[scheduleEvent]("event", ...args);
  },

  // Is worker connected to the content worker sandbox ?
  [inited]: false,

  // Is worker being frozen? i.e related document is frozen in bfcache.
  // Content script should not be reachable if frozen.
  [frozen]: true,

  setup(options={}) {
    if ('contentScriptFile' in options)
      this.contentScriptFile = options.contentScriptFile;
    if ('contentScriptOptions' in options)
      this.contentScriptOptions = options.contentScriptOptions;
    if ('contentScript' in options)
      this.contentScript = options.contentScript;

    setListeners(this, options);

    Object.assign({
      [inited]: false,
      [frozen]: true,
      [contentWorker]: null,
      [target]: null
    });

    // Ensure that worker._port is initialized for contentWorker to be able
    // to send events during worker initialization.
    this.port;

    if ("window" in options) {
      this[attach](options.window);
    }
  },

  [attach](window) {
    this[target] = window;
    // Track document unload to destroy this worker.
    // We can't watch for unload event on page's window object as it
    // prevents bfcache from working:
    // https://developer.mozilla.org/En/Working_with_BFCache
    this[windowID] = getInnerId(window);

    observers.on("inner-window-destroyed", this[onDocumentUnload]);

    // Listen to pagehide event in order to freeze the content script
    // while the document is frozen in bfcache:
    this[target].addEventListener("pageshow", this[onPageShow], true);
    this[target].addEventListener("pagehide", this[onPageHide], true);

    // will set this._contentWorker pointing to the private API:
    this[contentWorker] = WorkerSandbox(this);

    // Mainly enable worker.port.emit to send event to the content worker
    this[inited] = true;
    this[frozen] = false;

    // Process all scheduled events and messages that were fired before the
    // worker was initialized.
    this[scheduledEvents].forEach(({type, args}) =>
      this[dispatchEvent](type, ...args));
  },



  get url() {
    // this._window will be null after detach
    return this[target] ? this[target].document.location.href : null;
  },

  get tab() {
    // this._window will be null after detach
    return this[target] ? getTabForWindow(this[target]) : null;
  },

  /**
   * Tells content worker to unload itself and
   * removes all the references from itself.
   */
  dispose() {
    this[workerCleanup]();
    this[inited] = true;
    off(this);
  },

  /**
   * Remove all internal references to the attached document
   * Tells _port to unload itself and removes all the references from itself.
   */
  [workerCleanup]() {
    // maybe unloaded before content side is created
    // As Symbiont call worker.constructor on document load
    if (this[contentWorker]) {
      this[contentWorker].destroy();
    }
    this[contentWorker] = null;

    if (this[target]) {
      this[target].removeEventListener("pageshow", this[onPageShow], true);
      this[target].removeEventListener("pagehide", this[onPageHide], true);
    }
    this[target] = null;
    // This method may be called multiple times,
    // avoid dispatching `detach` event more than once
    if (this[windowID]) {
      this[windowID] = null;
      observers.off("inner-window-destroyed", this[onDocumentUnload]);
      this[scheduledEvents].splice(0);
      emit(this, "detach");
    }
    this[inited] = false;
  },

  /**
   * Receive an event from the content script that need to be sent to
   * worker.port. Provide a way for composed object to catch all events.
   */
  [onContentScriptEvent](...etc) {
    emit(this.port, ...etc);
  },

  /**
   * Reference to the content side of the worker.
   * @type {WorkerGlobalScope}
   */
  [contentWorker]: null,

  /**
   * Reference to the window that is accessible from
   * the content scripts.
   * @type {Object}
   */
  [target]: null,

  /**
   * Flag to enable `addon` object injection in document. (bug 612726)
   * @type {Boolean}
   */
  [injectInDocument]: false,

  [scheduleEvent](type, ...args) {
    if (this[inited]) {
      this[dispatchEvent](type, ...args);
    } else {
      this[earlyEvents].push({type, args});
    }
  },
  /**
   * Fired from this.postMessage and this[emitEventToContent], or from the
   * this[scheduledEvents] queue if events were scheduled before content was loaded.
   * Sends arguments to contentWorker if able.
   */
  [dispatchEvent](type, ...args) {
    if (!this[contentWorker]) {
      throw new Error(ERR_DESTROYED);
    }
    if (this[frozen]) {
      throw new Error(ERR_FROZEN);
    }

    this[contentWorker].emit(type, ...args);
  }
});
Worker.injectInDocument = injectInDocument;
exports.Worker = Worker;
