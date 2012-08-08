/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");
const { Loader } = require("test-harness/loader");
const timer = require("timer");
const URL = "data:text/html;charset=utf-8,<html><head><title>#title#</title></head></html>";
const tabs = require("tabs");
const tabsLen = tabs.length;

// TEST: tabs.activeTab getter
exports.testActiveTab_getter = function(test) {
  test.waitUntilDone();

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
          test.assertEqual(tabs.length, tabsLen, "tab was closed");

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
  let activateCount = 0;
  let newTabs = [];

  tabs.on('activate', function onActivate(tab) {
    test.assertEqual(windows.activeWindow.tabs.activeTab, tab,
                    "the active window's active tab is the tab provided");
    newTabs.push(tab);

    if (++activateCount == 2) {
      tabs.removeListener('activate', onActivate);

      newTabs.forEach(function(tab) {
        tab.close(function() {
          if (--activateCount == 0) {
            test.assertEqual(tabs.length, tabsLen, "tabs were closed");

            // end test
            test.done();
          }
        });
      });
    }
    else if (activateCount > 2) {
      test.fail("activateCount is greater than 2 for some reason..");
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

// TEST: tab.activate()
exports.testActiveTab_setter = function(test) {
  test.waitUntilDone();

  let url = URL.replace("#title#", "foo");
  let activeTabURL = tabs.activeTab.url;

  tabs.once('ready', function onReady(tab) {
    test.assertEqual(tabs.activeTab.url, activeTabURL, "activeTab url has not changed");
    test.assertEqual(tab.url, url, "url of new background tab matches");

    tabs.once('activate', function onActivate(eventTab) {
      test.assertEqual(tabs.activeTab.url, url, "url after activeTab setter matches");
      test.assertEqual(eventTab, tab, "event argument is the activated tab");
      test.assertEqual(eventTab, tabs.activeTab, "the tab is the active one");

      tab.close(function() {
        // end test
        test.done();
      });
    });

    tab.activate();
  });

  tabs.open({
    url: url,
    inBackground: true
  });
};

// TEST: tab unloader
exports.testAutomaticDestroy = function(test) {
  test.waitUntilDone();

  let called = false;

  let loader = Loader(module);
  let tabs2 = loader.require("tabs");
  let tabs2Len = tabs2.length;
  tabs2.on('open', function onOpen(tab) {
    test.fail("an onOpen listener was called that should not have been");
    called = true;
  });

  loader.unload();

  // Fire a tab event and ensure that the destroyed tab is inactive
  tabs.once('open', function(tab) {
    test.pass('tabs.once("open") works!');

    test.assertEqual(tabs2Len, tabs2.length, "tabs2 length was not changed");
    test.assertEqual(tabs.length, (tabs2.length+1), "tabs.length > tabs2.length");

    timer.setTimeout(function () {
      test.assert(!called, "Unloaded tab module is destroyed and inactive");

      tab.close(function() {
        // end test
        test.done();
      });
    });
  });

  tabs.open("data:text/html;charset=utf-8,foo");
};
