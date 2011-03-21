"use strict";

const { Hotkey } = require("hotkeys");
const { keyPress } = require("dom/events/keys");

exports["test hotkey"] = function(assert, done) {
  var element = require("window-utils").activeWindow.document.documentElement;
  var showHotKey = Hotkey({
    combination: "accel shift p",
    onPress: function() {
      assert.pass("first callback is called");
      keyPress(element, "accel alt shift p");
    }
  });

  var hideHotKey = Hotkey({
    combination: "accel alt shift p",
    onPress: function() {
      assert.pass("second callback is called");
      done();
    }
  });
  
  keyPress(element, "accel shift p");
};

require("test").run(exports);
