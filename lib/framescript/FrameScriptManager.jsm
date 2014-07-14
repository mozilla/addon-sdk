/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { utils: Cu, Constructor: CC, interfaces: Ci } = Components;
const { defer } = Cu.import('resource://gre/modules/Promise.jsm', {}).Promise;

const globalMM = Components.classes["@mozilla.org/globalmessagemanager;1"].
                 getService(Components.interfaces.nsIMessageListenerManager);

// Load frame scripts from the same dir as this module.
// Since this JSM will be loaded using require(), PATH will be
// overridden while running tests, just like any other module.
const PATH = __URI__.replace('FrameScriptManager.jsm', '');

// ensure frame scripts are loaded only once
let loadedTabEvents = false;

function enableTabEvents() {
  if (loadedTabEvents) 
    return;

  loadedTabEvents = true;
  globalMM.loadFrameScript(PATH + 'tab-events.js', true);
}

let helpers = new WeakMap();

function loadSandboxHelper(window) {
  let helper = helpers.get(window);
  if (!helper) {
    let { promise, resolve } = defer();
    helper = promise;
    helpers.set(window, helper);
    let mm = getFrameElement(window).frameLoader.messageManager;
    mm.addMessageListener('sdk/sandbox/init', function ssi() {
      mm.removeMessageListener('sdk/sandbox/init', ssi);
      resolve(mm);
    });
    mm.loadFrameScript('data:,new ' + function() {
      addMessageListener('sdk/sandbox/create', ({objects: { target, options, id }}) => {
        const { utils: Cu, Constructor: CC } = Components;
        const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();
        const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
        const { require: devtoolsRequire } = devtools;
        const { addContentGlobal, removeContentGlobal } = devtoolsRequire("devtools/server/content-globals");

        let sandbox = Cu.Sandbox(target || systemPrincipal, options);
        Cu.setSandboxMetadata(sandbox, options.metadata);
        let innerWindowID = options.metadata['inner-window-id'];
        if (innerWindowID) {
          addContentGlobal({
            global: sandbox,
            'inner-window-id': innerWindowID
          });
        }
        sendAsyncMessage('sdk/sandbox/result', null, { id: id, sandbox: sandbox });
      });
      sendAsyncMessage('sdk/sandbox/init');
    }, false);
  }
  return helper;
}

function getFrameElement(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
         getInterface(Ci.nsIDOMWindowUtils).containerElement || window.frameElement;
}

const EXPORTED_SYMBOLS = ['enableTabEvents', 'loadSandboxHelper'];
