/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader } = require("sdk/test/loader");
const { open, getMostRecentBrowserWindow, getOuterId } = require("sdk/window/utils");

exports["test browser events"] = function(assert, done) {
  let loader = Loader(module);
  let { events } = loader.require("sdk/window/events");
  let { spawn, STOP } = loader.require("signalize/core");
  let actual = [];

  spawn(events, function handler(e) {
    console.log("###", e && e.toSource())
    actual.push(e);
    if (e.type === "load") window.close();
    if (e.type === "close") {
      let [ open, ready, load, close ] = actual;
      assert.equal(open.type, "open")
      assert.equal(open.target, window, "window is open")

      assert.equal(ready.type, "DOMContentLoaded")
      assert.equal(ready.target, window, "window ready")

      assert.equal(load.type, "load")
      assert.equal(load.target, window, "window load")

      assert.equal(close.type, "close")
      assert.equal(close.target, window, "window load")

      //loader.unload();
      //done();
      return STOP;
    }
  });

  // Open window and close it to trigger observers.
  let window = open();
};

if (require("sdk/system/xul-app").is("Fennec")) {
  module.exports = {
    "test Unsupported Test": function UnsupportedTest (assert) {
        assert.pass(
          "Skipping this test until Fennec support is implemented." +
          "See bug 793071");
    }
  }
}

require("test").run(exports);
