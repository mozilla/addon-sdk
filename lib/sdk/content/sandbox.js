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
const { Content, Chrome, uri: bootstrapURI, makeAddress } = require("./script");

function importScripts(sandbox, urls) {
  urls.forEach(function(contentScriptFile) {
    let uri = URL(contentScriptFile);
    if (uri.scheme === 'resource') evaluate(sandbox, String(uri));
    else throw Error("Unsupported `contentScriptFile` url: " + String(uri));
  })
}
exports.importScripts = importScripts;

function evaluateScript(sandbox, code, filename) {
  evaluate(sandbox, filename || 'javascript:' + code, { source: code });
}
exports.evaluateScript = evaluateScript;

function WorkerSandbox({host, context, options, exposeKey, injectInDocument}) {
  // We receive a wrapped window, that may be an xraywrapper if it's content
  let prototype = context;
  let name = String(context.location);

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
  let contentConnect = evaluate(sandbox, bootstrapURI, {
    line: 21,
    source: "(" + Content + ")"
  });


  let address = makeAddress();
  contentConnect(address, JSON.stringify(options));
  Chrome(address, sandbox, host);

  // Inject `addon` global into target document if document is trusted,
  // `addon` in document is equivalent to `self` in content script.
  if (injectInDocument) {
    let window = context.wrappedJSObject ? context.wrappedJSObject : context;
    Object.defineProperty(window, "addon", {
      value: sandbox.self
    });
  }

  return sandbox;
};
exports.WorkerSandbox = WorkerSandbox;
