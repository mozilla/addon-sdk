/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var {Cc,Ci} = require("chrome");
const { Loader } = require("test-harness/loader");
const timer = require("timer");

// TEST: tabs.activeTab getter
exports.testActiveTab_getter = function(test) {
  test.waitUntilDone();

  let tabs = require("tabs");

  let url = "data:text/html;charset=utf-8,<html><head><title>foo</title></head></html>";
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
