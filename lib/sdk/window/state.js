/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

let { defer } = require("../core/promise");
let { on, off } = require("../dom/events");

function interactive(window) {
  // Returns promise that is resolved once document of the given window becomes
  // interactive or immediately if it already is.
  var { promise, resolve } = defer();
  var state = window.document.readyState;
  if (state === "interactive" || state === "complete") resolve(window);
  else {
    on(window, "DOMContentLoaded", function onReady(event) {
      if (event.target.defaultView === window) {
        off(window, "DOMContentLoaded");
        resolve(window);
      }
    });
  }
  return promise;
}
exports.interactive = interactive;

function loaded(window) {
  // Returns promise that is resolved once window document completes loading
  // or immediately if it's already completed loading.
  var { promise, resolve } = defer();
  var state = window.document.readyState;
  if (state === "complete") resolve(window);
  else {
    on(window, "load", function(event) {
       if (event.target.defaultView === window) {
        off(window, "load");
        resolve(window);
      }
    })
  }
  return promise;
}
exports.loaded = loaded;
