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
const { window } = require("../addon/window");
const { events } = require("../browser/events");
const { open } = require("../event/dom");
const systemEvents = require("../system/events");
const { merge, expand } = require("../event/utils");
const { emit } = require("../event/core");

let DOC_TYPES = ["DOMContentLoaded", "load"];

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
function documentEventsFor(document) {
  // Map supported event types to a streams of those events on the given
  // `window` for the inserted document and than merge these streams into
  // single form stream off all window state change events.
  let channels = DOC_TYPES.map(function(type) open(document.defaultView, type, {
    capture: true
  }));
  return merge(channels);
}

let stateChanges = expand(inserts, function({target}) documentEventsFor(target))

let loadState = open(window.document, 'load', { capture: true });

exports.events = merge([inserts, stateChanges, loadState]);
