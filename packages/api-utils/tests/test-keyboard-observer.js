"use strict";

const { keyPress } = require("api-utils/dom/events/keys");
const { Loader } = require("@loader");
const options = require("@packaging");
var windowUtils = require("api-utils/window-utils");
var keyboardObserver = require("api-utils/keyboard/observer");

exports["test unload keyboard observer"] = function(assert, done) {
  // Hacky way to be able to create unloadable modules via makeSandboxedLoader.
  let loader = Loader.new(options);
  let element = loader.require(module.uri, "api-utils/window-utils").
                       activeBrowserWindow.document.documentElement;
  let observer = loader.require(module.uri, "api-utils/keyboard/observer").
                        observer;
  let called = 0;

  observer.on("keypress", function () { called++; });

  // dispatching "keypress" event to trigger observer listeners.
  keyPress(element, "accel-%");

  // Unload the module.
  loader.unload();

  // dispatching "keypress" even once again.
  keyPress(element, "accel-%");

  // Enqueuing asserts to make sure that assertion is not performed early.
  require("timer").setTimeout(function () {
    assert.equal(called, 1, "observer was called before unload only.");
    done();
  }, 0);
};

require("test").run(exports);
