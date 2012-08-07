/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var {Cc,Ci} = require("chrome");
const { Loader } = require("test-harness/loader");
const timer = require("timer");
const URL = "data:text/html;charset=utf-8,<html><head><title>#title#</title></head></html>";

// TEST: tabs.activeTab getter
exports.testActiveTab_getter = function(test) {
  test.waitUntilDone();

  let tabs = require("tabs");

  let url = URL.replace("#title#", "foo");
  tabs.open({
    url: url,
    onOpen: function(tab) {
      test.assert(!!tabs.activeTab);
      test.assertEqual(tabs.activeTab, tab);

      tab.on("ready", function() {
        test.assertEqual(tab.url, url);
        test.assertEqual(tab.title, "foo");

        tab.close(function() {
          // end test
          test.done();
        });
      });
    }
  });
};

// TEST: activeWindow getter and activeTab getter on tab 'activate' event
exports.testActiveWindowActiveTabOnActivate = function(test) {
  test.waitUntilDone();

  let windows = require("windows").browserWindows;
  let tabs = require("tabs");
  let activateCount = 0;

  tabs.on('activate', function onActivate(tab) {
    test.assertEqual(windows.activeWindow.tabs.activeTab, tab,
                    "the active window's active tab is the tab provided");

    if (++activateCount >= 2) {
      // end test
      test.done();
    }
  });

  windows.open({
    url: URL.replace("#title#", "windows.open"),
    onOpen: function(window) {
      tabs.open({
        url: URL.replace("#title#", "tabs.open")
      });
    }
  });
};


