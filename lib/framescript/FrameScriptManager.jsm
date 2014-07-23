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
const SANDBOX_HELPER = PATH + 'SandboxHelper.jsm';
const TAB_EVENTS = PATH + 'tab-events.js';

globalMM.addMessageListener('sdk/sandbox/helper', _ => SANDBOX_HELPER);

// ensure frame scripts are loaded only once
let loadedTabEvents = false;

function enableTabEvents() {
  if (loadedTabEvents) 
    return;

  loadedTabEvents = true;
  globalMM.loadFrameScript(TAB_EVENTS, true);
}

const EXPORTED_SYMBOLS = ['enableTabEvents'];
