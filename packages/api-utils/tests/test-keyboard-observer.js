"use strict";

const { keyPress } = require("api-utils/dom/events/keys");

exports["test hotkey: automatic destroy"] = function(assert, done) {
  // Hacky way to be able to create unloadable modules via makeSandboxedLoader.
  let loader = assert._log.makeSandboxedLoader();
  
  var element = loader.require("api-utils/window-utils").activeBrowserWindow.
                document.documentElement;
  var observer = loader.require("api-utils/keyboard/observer")
  var called = 0;

  observer.once("keypress", function () { called++; });
  keyPress(element, "accel-%");

  assert.equal(1, called, "listener was called");
  // Unload the module so that previous hotkey is automatically destroyed
  loader.unload();

  observer.once("keypress", function () { called++; });

  // Ensure that the hotkey is really destroyed
  keyPress(element, "accel-%");
  console.log(called)

  require("timer").setTimeout(function () {
    assert.equal(called, 1, "observer was not called.");
    done();
  }, 0);
};

require("test").run(exports);
