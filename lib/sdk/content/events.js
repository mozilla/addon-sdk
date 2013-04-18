/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This module provides temporary shim until Bug 843901 is shipped.
// It basically registers tab event listeners on all windows that get
// opened and forwards them through observer notifications.

module.metadata = {
  "stability": "experimental"
};

const { Ci } = require("chrome");
const { windows, isInteractive } = require("../window/utils");
const { events } = require("../browser/events");
const { open } = require("../event/dom");
const systemEvents = require("../system/events");
const { filter, map, merge, expand } = require("../event/utils");
const { emit } = require("../event/core");

let TYPES = ["DOMContentLoaded"];//, "load"];

let inserts = {};
function onDocumentInsert({type, subject, data}) {
  emit(inserts, "data", {
    type: type,
    target: subject
  });
}

systemEvents.on("document-element-inserted", onDocumentInsert);

// Utility function that given a browser `window` returns stream of above
// defined tab events for all tabs on the given window.
function documentEventsFor(window) {
  console.log('window?',window);
  // Map supported event types to a streams of those events on the given
  // `window` and than merge these streams into single form stream off
  // all events.
  let channels = TYPES.map(function(type) open(window, type, {capture: true}));
  return merge(channels);
}

let docEvents = expand(function({target}) documentEventsFor(target), inserts)

exports.events = merge([inserts, docEvents]);
