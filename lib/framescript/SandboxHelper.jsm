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

const { ConsoleAPI } = Cu.import("resource://gre/modules/devtools/Console.jsm", {});
const console = new ConsoleAPI();

function sandbox(target, options) {
// options.metadata = JSON.parse(JSON.stringify(options.metadata));
  let { metadata } = options;
  delete options.metadata;
  let sandbox = Cu.Sandbox(target || systemPrincipal, options);
  Cu.setSandboxMetadata(sandbox, metadata);
  let innerWindowID = metadata['inner-window-id'];
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

remotePromise('init', (_, ...args) => sandbox(...args));
remotePromise('load', load); // result = { inject: (...args) => result.inject(...args) };
remotePromise('evaluate', evaluate);
remotePromise('nuke', nuke);

function remotePromise(name, response) {
  name = 'sdk/sandbox/' + name;
  cpmm.addMessageListener(name, ({ data: { id, waiveXrays }, objects }) => {
    // only respond to sandbox requests for window/sandbox from the same process
    if (Cu.isCrossProcessWrapper(objects[0]))
      return;
    try {
      let result = response(...objects);
      if (waiveXrays)
        result = Cu.waiveXrays(result);
      cpmm.sendAsyncMessage(name + '/response', { id }, { result });
    } catch (error) {
      cpmm.sendAsyncMessage(name + '/response', { id }, { error });
    }
  })
}

const EXPORTED_SYMBOLS = ['sandbox', 'load', 'evaluate', 'nuke'];

// for page-mod
Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService).addObserver(
  { observe: doc => cpmm.sendAsyncMessage('sdk/observer/document', null, { doc }) },
  'document-element-inserted', false);
