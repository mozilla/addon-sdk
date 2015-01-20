/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  engines: {
    "Firefox": "*"
  }
};

const { Loader } = require("sdk/test/loader");
const { open, getMostRecentBrowserWindow, getOuterId } = require("sdk/window/utils");
const { setTimeout } = require("sdk/timers");
const { defer } = require("sdk/core/promise");

exports["test browser events"] = function*(assert) {
  let loader = Loader(module);
  let { events } = loader.require("sdk/browser/events");
  let { on, off } = loader.require("sdk/event/core");
  let actual = [];
  let collectedActual = defer();

  on(events, "data", function handler(e) {
    actual.push(e);
    if (e.type === "load") {
      window.close();
    }
    else if (e.type === "close") {
      // Unload the module so that all listeners set by observer are removed.
      collectedActual.resolve();

      // Note: If window is closed right after this GC won't have time
      // to claim loader and there for this listener, therefor it's safer
      // to remove listener.
      off(events, "data", handler);
    }
  });

  // Open window and close it to trigger observers.
  let window = open();

  let [ ready, load, deactivate, activate, close ] = actual;
  let types = [ "DOMContentLoaded", "load", "deactivate", "activate", "close" ];

  yield collectedActual.promise;

  for (let { type, target } of actual) {
    let index = types.indexOf(type);
    if (index < 0) {
      return assert.fail("the type " + type + " is not valid");
    }

    assert.pass("event.type is valid");
    types.splice(index, 1);

    if (type == "DOMContentLoaded") {
      assert.ok(types.includes("load"), "DOMContentLoaded is before load");
      assert.ok(types.includes("close"), "DOMContentLoaded is before close");
    }
    else if (type == "load") {
      assert.ok(types.includes("close"), "load is before close");
    }
    else if (type == "deactivate") {
      assert.ok(types.includes("close"), "deactivate is before close");
    }

    if (type != "deactivate") {
      assert.equal(target, window, "event.target is window for " + type);
    }
    else {
      assert.notEqual(target, window, "event.target is not window for " + type);
    }
  }

  loader.unload();
};

exports["test browser events ignore other wins"] = function(assert, done) {
  let loader = Loader(module);
  let { events: windowEvents } = loader.require("sdk/window/events");
  let { events: browserEvents } = loader.require("sdk/browser/events");
  let { on, off } = loader.require("sdk/event/core");
  let actualBrowser = [];
  let actualWindow = [];

  function browserEventHandler(e) actualBrowser.push(e)
  on(browserEvents, "data", browserEventHandler);
  on(windowEvents, "data", function handler(e) {
    actualWindow.push(e);
    // Delay close so that if "load" is also emitted on `browserEvents`
    // `browserEventHandler` will be invoked.
    if (e.type === "load") setTimeout(window.close);
    if (e.type === "close") {
      // Ignore "deactivate" events since browser may have a focus.
      assert.deepEqual(actualBrowser.
                         filter(e => !/^(de)?activate$/.test(e.type)).
                         map(e => e.type),
                       [],
                       "browser events were not triggered");
      let [ open, ready, load, deactivate, activate, close ] = actualWindow;

      assert.equal(open.type, "open");
      assert.equal(open.target, window, "window is open");

      assert.equal(deactivate.type, "deactivate", "deactivate window")
      assert.notEqual(deactivate.target, window, "other window deactivated")

      assert.equal(ready.type, "DOMContentLoaded");
      assert.equal(ready.target, window, "window ready");

      assert.equal(load.type, "load");
      assert.equal(load.target, window, "window load");

      assert.equal(deactivate.type, "deactivate", "deactivate window")
      assert.notEqual(deactivate.target, window, "other window deactivated")

      assert.equal(activate.type, "activate", "activate event")
      assert.equal(activate.target, window, "target is window")

      assert.equal(close.type, "close");
      assert.equal(close.target, window, "window load");


      // Note: If window is closed right after this GC won't have time
      // to claim loader and there for this listener, there for it's safer
      // to remove listener.
      off(windowEvents, "data", handler);
      off(browserEvents, "data", browserEventHandler);
      loader.unload();
      done();
    }
  });

  // Open window and close it to trigger observers.
  let window = open("data:text/html,not a browser");
};

require("sdk/test").run(exports);
