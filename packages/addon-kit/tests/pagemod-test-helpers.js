"use strict";

const {Cc,Ci} = require("chrome");
const timer = require("timer");

/**
 * A helper function that creates a PageMod, then opens the specified URL
 * and checks the effect of the page mod on 'onload' event via testCallback.
 */
exports.testPageMod = function testPageMod(test, testURL, pageModOptions,
                                           testCallback, timeout, expectedWorkers) {
  var xulApp = require("xul-app");
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

  let loader = test.makeSandboxedLoader();
  let pageMod = loader.require("page-mod");

  var pageMods = [new pageMod.PageMod(opts) for each(opts in pageModOptions)];

  var tabBrowser = browserWindow.Browser || browserWindow.gBrowser;
  var newTab = tabBrowser.addTab(testURL);
  tabBrowser.selectedTab = newTab;
  var b = newTab.browser?newTab.browser:tabBrowser.getBrowserForTab(newTab);

  function onTestDone() {
    // Delay callback execute as page-mod content scripts may be executed on
    // load event. So page-mod actions may not be already done.
    // If we delay even more contentScriptWhen:'end', we may want to modify
    // this code again.
    timer.setTimeout(testCallback, 0,
      function (js, callback) {
        var pipe = require("remote-unique-pipe").loadRemoteScript(b,
          "data:text/javascript," +
          "Pipe.on('eval', function (js) {" +
          "  Pipe.emit('result', eval(js));" +
          "});");
        pipe.on('result', callback);
        pipe.emit('eval', js);
      },
      function done() {
        pageMods.forEach(function(mod) mod.destroy());
        // XXX leaks reported if we don't close the tab?
        tabBrowser.removeTab?tabBrowser.removeTab(newTab):tabBrowser.closeTab(newTab);
        loader.unload();
        test.done();
      });
  }
  var count = 0;
  if (!expectedWorkers)
    expectedWorkers = pageMods.length;
  function evaluated() {
    count++;
    if (count == expectedWorkers)
      onTestDone();
  }
  for each(var mod in pageMods) {
    mod.on("attach", function (worker) {
      worker.on("evaluated", evaluated);
    });
  }
  return pageMods;
}
