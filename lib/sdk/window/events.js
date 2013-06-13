/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Ci } = require("chrome");
const { observe } = require("../event/chrome");
const { open } = require("../event/dom");
const { windows } = require("../window/utils");
const { filter, merge, map, expand, concat, signal, spawn } = require("signalize/core");

// Function registers single shot event listeners for relevant window events
// that forward events to exported event stream.
function eventsFor(window) {
  let interactive = open(window, "DOMContentLoaded", { capture: true });
  let complete = open(window, "load", { capture: true });
  let states = merge([interactive, complete]);
  let changes = filter(function({target}) target === window.document, states);
  return map(function({type, target}) {
    return { type: type, target: target.defaultView }
  }, changes);
}

// In addition to observing windows that are open we also observe windows
// that are already already opened in case they're in process of loading.
let opened = windows(null, { includePrivate: true });

// Register system event listeners for top level window open / close.
function rename({type, target, data}) {
  return { type: rename[type], target: target, data: data }
}
rename.domwindowopened = "open";
rename.domwindowclosed = "close";

let openEvents = debug(map(rename, observe("domwindowopened")), "open");
let closeEvents = debug(map(rename, observe("domwindowclosed")), "close");
let futureWindows = debug(map(function({target}) target, openEvents), "future windows");

let allWindows = debug(concat(opened, futureWindows), "all windows");
let stateEvents = debug(expand(eventsFor, allWindows), "state");

let events = debug(merge([openEvents, closeEvents, stateEvents]), "merge");

function debug(input, message) {
  return signal(function(next) {
    spawn(input, function(value) {
      console.log(">>", message, value && value.toSource())
      var result = next(value)
      console.log("<<", message, result && result.toSource())
      return result
    })
  })
}

exports.events = events
