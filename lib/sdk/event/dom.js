/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

let { signal, STOP, END } = require("signalize/core");

// Simple utility function takes event target, event type and optional
// `options.capture` and returns signal of events of the given type that
// occur on a given `target` up until consumer returns `CLOSE` in which
// case listener is released.
function open(target, type, options) {
  let capture = options && options.capture ? true : false;

  return signal(function(next) {
    target.addEventListener(type, function handler(event) {
      let result = next(event);
      if (result === STOP) {
        target.removeEventListener(type, handler, capture);
        next(END);
      }
      return result;
    }, capture);
  });
}
exports.open = open;
