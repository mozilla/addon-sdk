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

require("test").run(exports);
