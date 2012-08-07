/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");
const { setTimeout } = require("timer");
const { Loader } = require('test-harness/loader');
const WM = Cc["@mozilla.org/appshell/window-mediator;1"].
           getService(Ci.nsIWindowMediator);
const { browserWindows } = require('windows');

// TEST: browserWindows.length
exports.testBrowserWindowsLength = function(test) {
  test.assertEqual(browserWindows.length, 1, "Only one window open");
};

// TEST: open & close window
exports.testOpenAndCloseWindow = function(test) {
  test.waitUntilDone();

  let tabCount = browserWindows.activeWindow.tabs.length;
  let url = "data:text/html;charset=utf-8,<title>windows%20API%20test</title>";

  browserWindows.open({
    url: url,
    onOpen: function(window) {
      test.assertEqual(this, browserWindows,
                    "The 'this' object is the windows object.");

      test.assertEqual(window.tabs.length, (tabCount+1), "Only one tab open");
      test.assertEqual(browserWindows.length, 1, "Only one window open");

      window.tabs.activeTab.on('ready', function onReady(tab) {
        tab.removeListener('ready', onReady);
        test.assertEqual(window.tabs.activeTab.url, url, "the active tab url is the opened url");
        test.assert(tab.title.indexOf("windows API test") != -1,
                 "URL correctly loaded");

        tab.on("close", function(tab) {
          test.assertEqual(window.tabs.length, tabCount, "Created tabs were cleared");
          test.assertEqual(browserWindows.length, 1, "Only one window open");

          // end test
          test.done();
        });

        tab.close();

      });

    }
  });
};
