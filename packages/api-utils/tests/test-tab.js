/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const tabAPI = require('tabs/tab');
const tabs = require("addon-kit/tabs"); // From addon-kit
const windowUtils = require("window-utils");
const { getTabForWindow } = require('tabs/helpers');

// The primary test tab
var primaryTab;

// We have an auxiliary tab to test background tabs.
var auxTab;

// The window for the outer iframe in the primary test page
var iframeWin;

exports.testGetTabForWindow = function(test) {
  test.waitUntilDone();

  test.assertEqual(getTabForWindow(windowUtils.activeWindow), null,
    "getTabForWindow return null on topwindow");
  test.assertEqual(getTabForWindow(windowUtils.activeBrowserWindow), null,
    "getTabForWindow return null on topwindow");

  let subSubDocument = encodeURIComponent(
    'Sub iframe<br/>'+
    '<iframe id="sub-sub-iframe" src="data:text/html;charset=utf-8,SubSubIframe" />');
  let subDocument = encodeURIComponent(
    'Iframe<br/>'+
    '<iframe id="sub-iframe" src="data:text/html;charset=utf-8,'+subSubDocument+'" />');
  let url = 'data:text/html;charset=utf-8,' + encodeURIComponent(
    'Content<br/><iframe id="iframe" src="data:text/html;charset=utf-8,'+subDocument+'" />');

  // Open up a new tab in the background.
  //
  // This lets us test whether GetTabForWindow works even when the tab in
  // question is not active.
  tabs.open({
    inBackground: true,
    url: "about:mozilla",
    onReady: function(tab) { auxTab = tab; step2(url, test);},
    onActivate: function(tab) { step3(test); }
  });
};

function step2(url, test) {

  tabs.open({
    url: url,
    onReady: function(tab) {
      primaryTab = tab;
      let window = windowUtils.activeBrowserWindow.content;

      let matchedTab = getTabForWindow(window);
      test.assertEqual(matchedTab, tab,
        "We are able to find the tab with his content window object");

      let timer = require("timer");
      function waitForFrames() {
        let iframe = window.document.getElementById("iframe");
        if (!iframe) {
          timer.setTimeout(waitForFrames, 100);
          return;
        }
        iframeWin = iframe.contentWindow;
        let subIframe = iframeWin.document.getElementById("sub-iframe");
        if (!subIframe) {
          timer.setTimeout(waitForFrames, 100);
          return;
        }
        let subIframeWin = subIframe.contentWindow;
        let subSubIframe = subIframeWin.document.getElementById("sub-sub-iframe");
        if (!subSubIframe) {
          timer.setTimeout(waitForFrames, 100);
          return;
        }
        let subSubIframeWin = subSubIframe.contentWindow;

        matchedTab = getTabForWindow(iframeWin);
        test.assertEqual(matchedTab, tab,
          "We are able to find the tab with an iframe window object");

        matchedTab = getTabForWindow(subIframeWin);
        test.assertEqual(matchedTab, tab,
          "We are able to find the tab with a sub-iframe window object");

        matchedTab = getTabForWindow(subSubIframeWin);
        test.assertEqual(matchedTab, tab,
          "We are able to find the tab with a sub-sub-iframe window object");

        // Put our primary tab in the background and test again.
        // The onActivate listener will take us to step3.
        auxTab.activate();
      }
      waitForFrames();
    }
  });
}

function step3(test) {

  let matchedTab = getTabForWindow(iframeWin);
  test.assertEqual(matchedTab, primaryTab,
    "We get the correct tab even when it's in the background");

  primaryTab.close(function () {
      auxTab.close(function () { test.done();});
    });
}
