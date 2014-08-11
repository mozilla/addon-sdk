/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { promise: windowPromise, close, focus } = require('sdk/window/helpers');
const { openTab, closeTab, getBrowserForTab } = require('sdk/tabs/utils');
const { version } = require('sdk/system');
const tabs = require('sdk/tabs');

exports.testTabIsRemote = function(assert, done) {
  const url = 'data:text/html,test-tab-is-remote';
  let tab = openTab(getMostRecentBrowserWindow(), url);
  assert.ok(tab.getAttribute('remote'), "The new tab should be remote");

  // can't simply close a remote tab before it is loaded, bug 1006043
  let mm = getBrowserForTab(tab).messageManager;
  mm.addMessageListener('7', function listener() {
    mm.removeMessageListener('7', listener);
    tabs.once('close', done);
    closeTab(tab);
  })
  mm.loadFrameScript('data:,sendAsyncMessage("7")', true);
}

// run e10s tests only on builds from trunk, fx-team, Nightly..
if (!version.endsWith('a1')) {
  module.exports = {};
}

function openE10sWindow() {
  let window = getMostRecentBrowserWindow().OpenBrowserWindow({ remote: true });
  return windowPromise(window, 'load').then(focus);
}

function makeE10sTests(exports) {
  let newExports = {};

  for (let key of Object.keys(exports)) {
    if (typeof(exports[key]) == "function" && key.substring(0, 4) == "test") {
      let testFunction = exports[key];
      newExports[key] = function(assert, done) {
        openE10sWindow().then(window => {
          testFunction(assert, () => {
            close(window).then(done);
          });
        });
      }
    }
  }

  return newExports;
}

module.exports = makeE10sTests(exports);

require('sdk/test/runner').runTestsFromModule(module);
