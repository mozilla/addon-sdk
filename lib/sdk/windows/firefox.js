/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

const { ignoreWindow } = require("../private-browsing/utils");
const { complement } = require("../lang/functional");
const { events } = require("../window/events");
const { on, emit } = require("../event/core");
const { modelFor } = require("../model/core");
const { BrowserWindow } = require("../window/model");
const { browserWindows } = require("../window/collection");

let isCompatible = complement(ignoreWindow);

let EVENT_TYPES = {
  // TODO: Pretending that window get's `open` on
  // `DOMContentLoaded` is nusty but it was already
  // a case. Maybe in a future we could use
  // `browser-delayed-startup-finished` instead.
  "DOMContentLoaded": "open",
  "load": "load",
  "activate": "activate",
  "deactivate": "deactivate",
  "close": "close"
};

// React to browser window related events by finding / creating
// high level wrapper and dispatching associated event on it.
on(events, "data", ({type, target}) => {
  type = EVENT_TYPES[type] || type;
  let model = modelFor(target);

  // Skip windows that are not compatible with privacy constraints.
  if (isCompatible(model)) {
    // Note: Emit on the model first to avoid cases where user
    // obtains window from collection first and later get same
    // event on the window it just obtained.
    emit(model, type, model);
    emit(browserWindows, type, model);
  }
});

exports.BrowserWindow = BrowserWindow;
exports.browserWindows = browserWindows;