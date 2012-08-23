/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { browserWindows } = require('windows');
const tabs = require('tabs');

const URL = 'data:text/html;charset=utf-8,<html><head><title>#title#</title></head></html>';

// TEST: tab count
exports.testTabCounts = function(test) {
  test.waitUntilDone();

  tabs.open({
    url: 'about:blank',
    onReady: function(tab) {
      let count1 = 0,
          count2 = 0;
      for each(let window in browserWindows) {
        count1 += window.tabs.length;
        for each(let tab in window.tabs) {
          count2 += 1;
        }
      }

      test.assert(tabs.length > 1, 'tab count is > 1');
      test.assertEqual(count1, tabs.length, 'tab count by length is correct');
      test.assertEqual(count2, tabs.length, 'tab count by iteration is correct');

      // end test
      tab.close(function() test.done());
    }
  });
};

// TEST: activeWindow getter and activeTab getter on tab 'activate' event
exports.testActiveWindowActiveTabOnActivate_alt = function(test) {
  test.waitUntilDone();

  let activateCount = 0;
  let newTabs = [];

  tabs.on('activate', function onActivate(tab) {
    test.assert(browserWindows.activeWindow.tabs.activeTab === tab,
                    "the active window's active tab is the tab provided");

    if (++activateCount == 2) {
      tabs.removeListener('activate', onActivate);

      newTabs.forEach(function(tab) {
        tab.close(function() {
          if (--activateCount == 0) {
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

  tabs.open({
    url: URL.replace("#title#", "tabs.open1"),
    onOpen: function(tab) newTabs.push(tab)
  });
  tabs.open({
    url: URL.replace("#title#", "tabs.open2"),
    onOpen: function(tab) newTabs.push(tab)
  });
};
