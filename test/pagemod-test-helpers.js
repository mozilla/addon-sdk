/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc,Ci} = require("chrome");
const xulApp = require("sdk/system/xul-app");
const { Loader } = require("sdk/test/loader");
const { openTab, getBrowserForTab, closeTab } = require("sdk/tabs/utils");

/**
 * An evil function that creates a PageMod, then opens the specified URL
 * and checks the effect of the page mod on 'onload' event via testCallback.
 */
exports.testPageMod = function testPageMod(assert, done, testURL, pageModOptions,
                                           testCallback, timeout) {
  var wm = Cc['@mozilla.org/appshell/window-mediator;1']
           .getService(Ci.nsIWindowMediator);
  var browserWindow = wm.getMostRecentWindow("navigator:browser");
  if (!browserWindow) {
    assert.pass("page-mod tests: could not find the browser window, so " +
              "will not run. Use -a firefox to run the pagemod tests.")
    return null;
  }

  const loader = Loader(module);
  const { PageMod } = loader.require("sdk/page-mod");

  let pageMods = pageModOptions.map(opts => PageMod(opts));

  pageMods[0].on('attach', callback);
  let newTab = openTab(browserWindow, testURL);

  function callback() {
    let b = getBrowserForTab(newTab);
    testCallback(b && b.contentWindow, () => {
      pageMods.forEach(mod => mod.destroy());
      closeTab(newTab);
      loader.unload();
      done();
    })
  }

  return pageMods;
}

/**
 * helper function that creates a PageMod and calls back the appropriate handler
 * based on the value of document.readyState at the time contentScript is attached
 */
exports.handleReadyState = function(url, contentScriptWhen, callbacks) {
  const loader = Loader(module);
  const { PageMod } = loader.require('sdk/page-mod');

  let pagemod = PageMod({
    include: url,
    attachTo: ['existing', 'top'],
    contentScriptWhen: contentScriptWhen,
    contentScript: "self.postMessage(document.readyState)",
    onAttach: worker => {
      let { tab } = worker;
      worker.on('message', readyState => {
        // generate event name from `readyState`, e.g. `"loading"` becomes `onLoading`.
        let type = 'on' + readyState[0].toUpperCase() + readyState.substr(1);

        worker.destroy();
        pagemod.destroy();

        if (type in callbacks)
          callbacks[type](tab); 

        loader.unload();
      })
    }
  });
}
