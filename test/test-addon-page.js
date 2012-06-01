/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { isTabOpen, activateTab, openTab, closeTab, getURI } = require('api-utils/tabs/utils');
const windows = require('api-utils/window-utils');
const { Loader } = require('test-harness/loader');
const { setTimeout } = require('api-utils/timer');

let uri = require('self').data.url('index.html');

function isChromeVisible(window)
  window.document.documentElement.getAttribute('disablechrome') !== 'true'

exports['test that add-on page has no chrome'] = function(assert, done) {
  let loader = Loader(module);
  loader.require('addon-kit/addon-page');

  let window = windows.activeBrowserWindow;
  let tab = openTab(window, uri);

  assert.ok(isChromeVisible(window), 'chrome is visible for non addon page');

  // need to do this in another turn to make sure event listener
  // that sets property has time to do that.
  setTimeout(function() {
    activateTab(tab);

    assert.ok(!isChromeVisible(window), 'chrome is not visible for addon page');

    closeTab(tab);
    assert.ok(isChromeVisible(window), 'chrome is visible again');
    loader.unload();
    done();
  });
};

exports['test that add-on pages are closed on unload'] = function(assert, done) {
  let loader = Loader(module);
  loader.require('addon-kit/addon-page');

  let tab = openTab(windows.activeBrowserWindow, uri);

  // Wait for addon page document to be loaded
  tab.addEventListener("load", function listener() {
    // Ignore loading of about:blank document
    if (getURI(tab) != uri)
      return;
    tab.removeEventListener("load", listener, false);

    loader.unload();
    assert.ok(!isTabOpen(tab), 'add-on page tabs are closed on unload');

    done();
  }, false);
};


require('test').run(exports);
