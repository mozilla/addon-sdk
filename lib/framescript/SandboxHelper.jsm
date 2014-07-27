/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { utils: Cu, interfaces: Ci, classes: Cc, Constructor: CC } = Components;

const scriptLoader = Cc['@mozilla.org/moz/jssubscript-loader;1'].
                     getService(Ci.mozIJSSubScriptLoader);
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { addContentGlobal } = devtools['require']("devtools/server/content-globals");

const cpmm = Cc["@mozilla.org/childprocessmessagemanager;1"].
             getService(Ci.nsISyncMessageSender);

cpmm.addMessageListener("sdk/sandbox/init", ({ objects: { target, options, id }}) => {
  // only respond to sandbox requests for windows from the same process
  if (Cu.isCrossProcessWrapper(options.sandboxPrototype))
    return;
  try {
    options.metadata = JSON.parse(JSON.stringify(options.metadata));
    let sandbox = sandboxActual(target, options);
    sandbox = Cu.waiveXrays(sandbox);
    cpmm.sendAsyncMessage('sdk/sandbox/result', null, { id, sandbox: sandbox });
  } catch (e) {
    cpmm.sendAsyncMessage('sdk/sandbox/result', null, { id: id, error: e });
  }
})

remotePromise('init', ({ target, options }) => {
  options.metadata = JSON.parse(JSON.stringify(options.metadata));
  let result = sandbox(target, options);
  return Cu.waiveXrays(result);
})

remotePromise('load', ({ sandbox, uri } => {
  let result = load(sandbox, uri);
  result = Cu.waiveXrays(result);
  result = { inject: (...args) => {
    let { emitToContent, hasListenerFor } = result.inject(...args);
    return { emitToContent, hasListenerFor };
  }}
  return result;
})

remotePromise('evaluate', { sandbox, code, uri, line, version } =>> {
  let result = evaluate(sandbox, code, uri, line, version);
  return Cu.waiveXrays(result);
})

remotePromise('nuke', ({ sandbox }) => {
  nuke(sandbox);
})

cpmm.addMessageListener("sdk/sandbox/load", ({ objects: { sandbox, uri, id }}) => {
  // only respond to sandbox requests for windows from the same process
  if (Cu.isCrossProcessWrapper(sandbox))
    return;
  try {
    // sandbox = Cu.waiveXrays(sandbox);
    let result2 = load(sandbox, uri);
    result2 = Cu.waiveXrays(result2);
    let result = { inject: (...args) => {
      let x = result2.inject(...args);
      return {
        emitToContent: x.emitToContent,
        hasListenerFor: x.hasListenerFor
      }
    }};
    cpmm.sendAsyncMessage('sdk/sandbox/lresult', null, { id: id, result: result });
  } catch (e) {
    cpmm.sendAsyncMessage('sdk/sandbox/lresult', null, { id: id, error: e });
  }
})

cpmm.addMessageListener("sdk/sandbox/eval", ({ objects: { sandbox, code, uri, line, version, id }}) => {
  // only respond to sandbox requests for windows from the same process
  if (Cu.isCrossProcessWrapper(sandbox))
    return;
  try {
    let result = evaluate(sandbox, code, uri, line, version);
    result = Cu.waiveXrays(result);
    cpmm.sendAsyncMessage('sdk/sandbox/eresult', null, { id: id, result: result });
  } catch (e) {
    cpmm.sendAsyncMessage('sdk/sandbox/eresult', null, { id: id, error: e });
  }
})

// for page-mod
Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService).addObserver(
  {observe: subject => cpmm.sendAsyncMessage('sdk/observer/document', null, { subject })},
  'document-element-inserted', false);

function remotePromise(name, response) {
  name = 'sdk/sandbox' + name;
  cpmm.addMessageListener(name, ({ data: { id }, objects }) => {
    // only respond to sandbox requests for window/sandbox from the same process
    if (Cu.isCrossProcessWrapper(objects.sandbox))
      return;
    try {
      let result = response(objects);
      cpmm.sendAsyncMessage(name + '/response', { id }, { result });
    } catch (error) {
      cpmm.sendAsyncMessage(name + '/response', { id }, { error });
    }
  })
}

function sandbox(target, options) {
  let sandbox = Cu.Sandbox(target || systemPrincipal, options);
  Cu.setSandboxMetadata(sandbox, options.metadata);
  let innerWindowID = options.metadata['inner-window-id'];
  if (innerWindowID) {
    addContentGlobal({ global: sandbox, 'inner-window-id': innerWindowID });
  }
  return sandbox;
}

function load(sandbox, uri) {
  if (uri.indexOf('data:') === 0) {
    let source = uri.substr(uri.indexOf(',') + 1);

    return evaluate(sandbox, decodeURIComponent(source), '1.8', uri, 0);
  } else {
    return scriptLoader.loadSubScript(uri, sandbox, 'UTF-8');
  }
}

function evaluate(sandbox, code, uri, line, version) {
  return Cu.evalInSandbox(code, sandbox, version || '1.8', uri || '', line || 1);
}

function nuke(sandbox) {
  Cu.nukeSandbox(sandbox);
}

const EXPORTED_SYMBOLS = ['sandbox', 'load', 'evaluate', 'nuke'];
