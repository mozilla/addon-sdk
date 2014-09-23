/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Loader } = require('sdk/test/loader');
const { openTab, getBrowserForTab, closeTab } = require('sdk/tabs/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { merge } = require("sdk/util/object");

const options = merge({}, require('@loader/options'),
                      { prefixURI: require('./fixtures').url() });

// an evil function enables the creation of tests
// that depend on delicate event timing. DO NOT USE!
function testPageMod(_, done, testURL, pageModOptions, testCallback) {

  const loader = Loader(module, null, options);
  const { PageMod } = loader.require('sdk/page-mod');

  let pageMods = pageModOptions.map(opts => PageMod(opts));
  pageMods[0].on('attach', callback);

  let newTab = openTab(getMostRecentBrowserWindow(), testURL);

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
exports.testPageMod = testPageMod;

// helper function that creates a PageMod and calls back the appropriate handler
// based on the value of document.readyState at the time contentScript is attached
function handleReadyState(url, contentScriptWhen, callbacks) {
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
exports.handleReadyState = handleReadyState;