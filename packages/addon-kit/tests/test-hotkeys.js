"use strict";

const { Hotkey } = require("hotkeys");
const { keyPress } = require("dom/events/keys");

exports["test hotkey: accel alt shift"] = function(assert, done) {
  var element = require("window-utils").activeWindow.document.documentElement;
  var showHotKey = Hotkey({
    combo: "accel-shift-p",
    onPress: function() {
      assert.pass("first callback is called");
      keyPress(element, "accel-alt-shift-p");
      showHotKey.destroy();
    }
  });

  var hideHotKey = Hotkey({
    combo: "accel-alt-shift-p",
    onPress: function() {
      assert.pass("second callback is called");
      hideHotKey.destroy();
      done();
    }
  });
  
  keyPress(element, "accel-shift-p");
};

exports["test invalid combos"] = function(assert) {
  assert.throws(function() {
    Hotkey({
      combo: "d",
      onPress: function() {}
    });
  }, "throws if no modifier is present");
  assert.throws(function() {
    Hotkey({
      combo: "alt",
      onPress: function() {}
    });
  }, "throws if no key is present");
  assert.throws(function() {
    Hotkey({
      combo: "alt p b",
      onPress: function() {}
    });
  }, "throws if more then one key is present");

};

require("test").run(exports);
