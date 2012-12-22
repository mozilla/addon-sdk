/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let { Cc, Ci } = require("chrome");
let { EventTarget } = require("../event/target");
let { emit, count } = require("../event/core");
let { fold } = require("../event/utils");
let { windows } = require("./utils");
let { when: unload } = require("../system/unload");


function True() true

let windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].
                    getService(Ci.nsIWindowWatcher);


// Define set of window open / close / shutdown channels,
// each is event emitter on which asserted event is emitted
// once window is opened / closed and on all open windows
// shutdown is called on add-on unload. Also note that what
// we expose are functions that return those event channels,
// that way we can share one observer for window watcher and
// do the distribution with event emitters.

let open = EventTarget();
exports.open = function() open

let close = EventTarget();
exports.close = function() close

let shutdown = EventTarget();
exports.shutdown = function() shutdown

// window watcher is used to observe window open / close events.
let observer = {
  observe: function(subject, topic) {
    let window = subject.QueryInterface(Ci.nsIDOMWindow);
    if (topic === "domwindowopened") emit(open, "data", window);
    if (topic === "domwindowclosed") emit(close, "data", window);
  }
}
windowWatcher.registerNotification(observer);

// Once add-on is unloaded, unregister observer and emit shutdown events
// so that associated cleanup can be done, `close` events are not emitted
// intentionally since that's misleading and is problematic, it's better
// to handle both in same way if that's desired in specific scenarios.
unload(function() {
  windowWatcher.unregisterNotification(observer);
  windows().forEach(function(window) emit(shutdown, "data", window))
});


// Another event channel exported by this module is `read` that can be used
// to track all the windows that become ready from the point of execution.

function isReady(document) {
  return document.readyState === "interactive" ||
         document.readyState === "complete"
}

function ready(capture) {
  // Returns channel of windows who's document's become interactive, also
  // notice that same window may become interactive.
  capture = capture || false;
  let output = EventTarget();
  // same event listener is shared for optimisation purposes. Note that
  // all bubbled events from nested documents are ignored as this covers
  // only top level windows.
  function listener(event) {
    if (event.currentTarget === event.target.defaultView)
      emit(output, "output", event.currentTarget);
  }

  // every open window is registered and if it's document is already
  // interactive event is emitted immediately. Otherwise listener is
  // registered.
  fold(open, function register(window) {
    if (isReady(window.document)) emit(output, "data", window);
    else window.addEventListener("DOMContentLoaded", listener, capture);
  });
  // every listener is unregistered once it's being closed.
  fold(close, function unregister(window) {
    window.removeEventListener("DOMContentLoaded", listener, capture);
  });

  return output;
}
exports.ready = ready;

// windows that are loaded can be observed same as when they become
// interactive.

function isLoaded(document) document.readyState === "complete"
function load(capture) {
  capture = capture || false;
  let output = EventTarget();
  let listener = {
    handleEvent: function(event) {
      if (event.currentTarget === event.target.defaultView)
        emit(output, "data", event.currentTarget);
    }
  };

  fold(open, function register(window) {
    if (isLoaded(window.document)) emit(output, "data", window);
    else window.addEventListener("load", listener, capture);
  });
  fold(close, function unregister(window) {
    window.removeEventListener("load", listener, capture)
  });

  return output;
}
exports.load = load;
