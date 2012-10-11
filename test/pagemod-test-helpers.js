/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc,Ci} = require("chrome");
const timer = require("sdk/timers");
const xulApp = require("sdk/system/xul-app");
const { Loader } = require("sdk/test/loader");

/**
 * A helper function that creates a PageMod, then opens the specified URL
 * and checks the effect of the page mod on 'onload' event via testCallback.
 */
exports.testPageMod = function testPageMod(test, testURL, pageModOptions,
                                           testCallback, timeout) {
  if (!xulApp.versionInRange(xulApp.platformVersion, "1.9.3a3", "*") &&
      !xulApp.versionInRange(xulApp.platformVersion, "1.9.2.7", "1.9.2.*")) {
    test.pass("Note: not testing PageMod, as it doesn't work on this platform version");
    return null;
  }

  var wm = Cc['@mozilla.org/appshell/window-mediator;1']
           .getService(Ci.nsIWindowMediator);
  var browserWindow = wm.getMostRecentWindow("navigator:browser");
  if (!browserWindow) {
    test.pass("page-mod tests: could not find the browser window, so " +
              "will not run. Use -a firefox to run the pagemod tests.")
    return null;
  }

  if (timeout !== undefined)
    test.waitUntilDone(timeout);
  else
    test.waitUntilDone();

  let loader = Loader(module);
  let pageMod = loader.require("sdk/page-mod");

  var pageMods = [new pageMod.PageMod(opts) for each(opts in pageModOptions)];

  var tabBrowser = browserWindow.gBrowser;
  var newTab = tabBrowser.addTab(testURL);
  tabBrowser.selectedTab = newTab;
  var b = tabBrowser.getBrowserForTab(newTab);

  function onPageLoad() {
    b.removeEventListener("load", onPageLoad, true);
    // Delay callback execute as page-mod content scripts may be executed on
    // load event. So page-mod actions may not be already done.
    // If we delay even more contentScriptWhen:'end', we may want to modify
    // this code again.
    timer.setTimeout(testCallback, 0,
      b.contentWindow.wrappedJSObject, 
      function done() {
        pageMods.forEach(function(mod) mod.destroy());
        // XXX leaks reported if we don't close the tab?
        tabBrowser.removeTab(newTab);
        loader.unload();
        test.done();
      }
    );
  }
  b.addEventListener("load", onPageLoad, true);

  return pageMods;
}
