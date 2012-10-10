/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader } = require("test-harness/loader");
const timer = require("timer");

exports["test unload window observer"] = function(assert, done) {
  // Hacky way to be able to create unloadable modules via makeSandboxedLoader.
  let loader = Loader(module);

  let utils = loader.require("api-utils/window-utils");
  let { activeBrowserWindow: activeWindow } = utils;
  let { isBrowser } = require('api-utils/window/utils');
  let observer = loader.require("api-utils/windows/observer").observer;
  let opened = 0;
  let closed = 0;

  observer.on("open", function onOpen(window) {
    // Ignoring non-browser windows
    if (isBrowser(window))
      opened++;
  });
  observer.on("close", function onClose(window) {
    // Ignore non-browser windows & already opened `activeWindow` (unload will
    // emit close on it even though it is not actually closed).
    if (isBrowser(window) && window !== activeWindow)
      closed++;
  });

  // Open window and close it to trigger observers.
  activeWindow.open().close();

  // Unload the module so that all listeners set by observer are removed.
  loader.unload();

  // Open and close window once again.
  activeWindow.open().close();

  // Enqueuing asserts to make sure that assertion is not performed early.
  timer.setTimeout(function () {
    assert.equal(1, opened, "observer open was called before unload only");
    assert.equal(1, closed, "observer close was called before unload only");
    done();
  }, 0);
};

require("test").run(exports);
