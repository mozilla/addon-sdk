"use strict";

const { openTab, closeTab } = require("api-utils/tabs/utils");

exports["test unload tab observer"] = function(assert, done) {
  // Hacky way to be able to create unloadable modules via makeSandboxedLoader.
  let loader = assert._log.makeSandboxedLoader();


  let window = loader.require("api-utils/window-utils").activeBrowserWindow;
  let observer = loader.require("api-utils/tabs/observer");
  let opened = 0;
  let closed = 0;

  observer.on("open", function onOpen(window) { opened++; });
  observer.on("close", function onClose(window) { closed++; });

  // Open and close tab to trigger observers.
  closeTab(openTab(window, "data:text/html,tab-1"));

  // Unload the module so that all listeners set by observer are removed.
  loader.unload();

  // Open and close tab once again.
  closeTab(openTab(window, "data:text/html,tab-2"));

  // Enqueuing asserts to make sure that assertion is not performed early.
  require("timer").setTimeout(function () {
    assert.equal(1, opened, "observer open was called before unload only");
    assert.equal(1, closed, "observer close was called before unload only");
    done();
  }, 0);
};

require("test").run(exports);
