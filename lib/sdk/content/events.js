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
const { merge } = require("../event/utils");
const { emit } = require("../event/core");

let TYPES = ["DOMContentLoaded", "load"];

let inserts = {};
function onDocumentInsert({type, subject, data}) {
  emit(inserts, "data", {
    type: type,
    target: subject
  });
}

systemEvents.on("document-element-inserted", onDocumentInsert);

// Use window.document for binding for the `load` event coming from
// page-worker's iframe -- document from system event does not receive this
let docEvents = TYPES.map(function(type) open(window.document, type, {capture: true}));

exports.events = merge([inserts, merge(docEvents)]);
