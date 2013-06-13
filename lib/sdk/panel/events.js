/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This module basically translates system/events to a SDK standard events
// so that `map`, `filter` and other utilities could be used with them.

module.metadata = {
  "stability": "experimental"
};

const { observe } = require("../event/chrome");
const { expand, spawn } = require("signalize/core");

let events = expand(observe, [
  "sdk-panel-show", "sdk-panel-hide", "sdk-panel-shown", "sdk-panel-hidden",
  "sdk-panel-content-changed", "sdk-panel-content-loaded",
  "sdk-panel-document-loaded"
]);

exports.events = events;
