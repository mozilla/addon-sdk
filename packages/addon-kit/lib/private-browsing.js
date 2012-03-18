/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { emit, on, once, off } = require("api-utils/event/core");
const { defer } = require("api-utils/functional");
const { when: unload } = require("api-utils/unload");
const observers = require("api-utils/observer-service");

// Model holding a state.
const model = { active: false };

let deferredEmit = defer(emit);

let pbService;
// Currently, only Firefox implements the private browsing service.
if (require("api-utils/xul-app").is("Firefox")) {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);

  // Update model state.
  model.active = pbService.privateBrowsingEnabled;

  // set up an observer for private browsing switches.
  observers.add('private-browsing-transition-complete', function onChange() {
    // Update model state.
    model.active = pbService.privateBrowsingEnabled;
    // Emit event with in next turn of event loop.
    deferredEmit(exports, model.active ? 'start' : 'stop');
  });
}

let setMode = defer(function setMode(value) {
  // We toggle private browsing mode asynchronously in order to work around
  // bug 659629.  Since private browsing transitions are asynchronous
  // anyway, this doesn't significantly change the behavior of the API.
  pbService.privateBrowsingEnabled = !!value
});


// Make sure listeners are cleaned up.
unload(function() off(exports));

Object.defineProperty(exports, "isActive", { get: function() model.active });
exports.activate = function activate() pbService && setMode(true)
exports.deactivate = function deactivate() pbService && setMode(false)
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.removeListener = function removeListener(type, listener) {
  // Note: We can't just bind `off` as we do it for other methods cause skipping
  // a listener argument will remove all listeners for the given event type
  // causing misbehavior. This way we make sure all arguments are passed.
  off(exports, type, listener);
};

// This is workaround making sure that exports is wrapped before it's
// frozen, which needs to happen in order to workaround Bug 673468.
off(exports, 'workaround-bug-673468');
