/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require("../core/heritage");
const { Disposable } = require("../core/disposable");
const { emit, on, off, setListeners } = require("../event/core");
const { setTimeout, setInterval,
        clearTimeout, clearInterval } = require("../timers");
const { URL } = require("../url");
const { Sandbox: makeSandbox, evaluate } = require("toolkit/loader");
const { merge } = require("../util/object");
const { defer } = require("../lang/functional");
const xulApp = require("../system/xul-app");
const USE_JS_PROXIES = !xulApp.versionInRange(xulApp.platformVersion,
                                              "17.0a2", "*");

/* Trick the linker in order to ensure shipping these files in the XPI.
  require('./content-proxy.js');
  require('./content-worker.js');
  Then, retrieve URL of these files in the XPI:
*/
let prefix = module.uri.split('sandbox.js')[0];
const CONTENT_PROXY_URL = prefix + 'content-proxy.js';
const CONTENT_WORKER_URL = prefix + 'content-worker.js';

const JS_VERSION = '1.8';



//  Emit that emits events in a next tick.
var emitAsync = defer(emit);

function serialize(json) {
  // JSON.stringify is buggy with cross-sandbox values,
  // it may return "{}" on functions. Use a replacer to match them correctly.
  return JSON.stringify(json, serialize.replacer);
}
serialize.replacer = function replacer(_, value) {
  return typeof(value) === "function" ? undefined : value;
}

function importScripts(sandbox, urls) {
  urls.forEach(function(contentScriptFile) {
    let uri = URL(contentScriptFile);
    if (uri.scheme === 'resource') evaluate(sandbox, String(uri));
    else throw Error("Unsupported `contentScriptFile` url: " + String(uri));
  })
}
exports.importScripts = importScripts;

function evaluateScript(sandbox, code, filename) {
  evaluate(sandbox, filename || 'javascript:' + code, {
    source: code
  });
}
exports.evaluateScript = evaluateScript;

function makeAPI() {
  // Then call `inject` method and communicate with this script
  // by trading two methods that allow to send events to the other side:
  //   - `onEvent` called by content script
  //   - `result.emitToContent` called by addon script
  // Bug 758203: We have to explicitely define `__exposedProps__` in order
  // to allow access to these chrome object attributes from this sandbox with
  // content priviledges
  // https://developer.mozilla.org/en/XPConnect_wrappers#Other_security_wrappers
  return {
    timers: {
      setTimeout: setTimeout,
      setInterval: setInterval,
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
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
}

function WorkerSandbox({host, context, options, exposeKey, injectInDocument}) {
  // We receive a wrapped window, that may be an xraywrapper if it's content
  let prototype = context;
  let name = String(context.location);

  // Instantiate trusted code in another Sandbox in order to prevent content
  // script from messing with standard classes used by proxy and API code.
  let apiSandbox = makeSandbox({
    name: name,
    principal: context,
    wantXrays: true
  });

  let wrap = null;

  // Build content proxies only if the document has a non-system principal
  // And only on old firefox versions that doesn't ship bug 738244
  if (USE_JS_PROXIES && XPCNativeWrapper.unwrap(context) !== context) {
    apiSandbox.console = console;
    // Execute the proxy code
    evaluate(apiSandbox, CONTENT_PROXY_URL);
    // Get a reference of the window's proxy
    prototype = apiSandbox.create(context);
    // Keep a reference to `wrap` function for `emitSync` usage
    wrap = apiSandbox.wrap;
  }

  // Create the sandbox and bind it to window in order for content scripts to
  // have access to all standard globals (window, document, ...)
  let sandbox = makeSandbox({
    name: name,
    principal: context,
    prototype: prototype,
    wantXrays: true
  });

  // We have to ensure that window.top and window.parent are the exact same
  // object than window object, i.e. the sandbox global object. But not
  // always, in case of iframes, top and parent are another window object.
  let top = context.top === context ? sandbox : sandbox.top;
  let parent = context.parent === context ? sandbox : sandbox.parent;
  merge(sandbox, {
    // We need "this === window === top" to be true in toplevel scope:
    get window() sandbox,
    get top() top,
    get parent() parent,
    // Use the Greasemonkey naming convention to provide access to the
    // unwrapped window object so the content script can access document
    // JavaScript values.
    // NOTE: this functionality is experimental and may change or go away
    // at any time!
    get unsafeWindow() context.wrappedJSObject
  });

  // Load trusted code that will inject content script API.
  // We need to expose JS objects defined in same principal in order to
  // avoid having any kind of wrapper.
  evaluate(apiSandbox, CONTENT_WORKER_URL);

  // prepare a clean `self.options`
  options = options ? JSON.stringify(options) : undefined;

  function onEvent(message) {
    try {
      let event = [host].concat(JSON.parse(message));
      emitAsync.apply(emitAsync, event);
    } catch (error) {
      emit(host, "error", error);
    }
  }

  let chromeAPI = makeAPI();
  // `ContentWorker` is defined in CONTENT_WORKER_URL file
  let result = apiSandbox.ContentWorker.inject(sandbox, chromeAPI, options, onEvent);
  let emitToContentSync = result.emitToContent;
  let emitToContentAsync = defer(emitToContentSync);

  // Internal feature that is only used by SDK tests:
  // Expose unlock key to content script context.
  // See `PRIVATE_KEY` definition for more information.
  if (apiSandbox && exposeKey)
    sandbox.UNWRAP_ACCESS_KEY = apiSandbox.UNWRAP_ACCESS_KEY;

  // Inject `addon` global into target document if document is trusted,
  // `addon` in document is equivalent to `self` in content script.
  if (injectInDocument) {
    let window = context.wrappedJSObject ? context.wrappedJSObject : context;
    Object.defineProperty(window, "addon", {
      value: sandbox.self
    });
  }

  on(sandbox, "*", function onChromeEvent(type) {
    let args = Array.slice(arguments);

    // Event types that start with `!` are treated specially, and are
    // forwarded to a content worker synchronously. Unfortunately sync
    // dispatch is necessary as context-menu depends on this.
    if (type[0] === "!") {
      args[0] = type.substr(1);
      // Bug 732716: Ensure wrapping xrays sent to the content script
      // otherwise it will have access to raw xraywrappers and content script
      // will assume it is an user object coming from the content script sandbox
      if (wrap) args = args.map(wrap);
      return emitToContentSync(args);
    }
    else {
      emitToContentAsync(serialize(args));
    }
  });

  return sandbox;
};
exports.WorkerSandbox = WorkerSandbox;
