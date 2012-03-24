/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { emit, off } = require("api-utils/event/core");
const { EventTarget } = require("api-utils/event/target");
const { when: unload } = require("api-utils/unload");
const { jetpackID } = require("@packaging");
const Prefs = require("api-utils/preferences-service");
const { PrefsObserver } = require("api-utils/prefs/observer.js");
const observers = require("api-utils/observer-service");

const ADDON_BRANCH = "extensions." + jetpackID + ".";
const BUTTON_PRESSED = jetpackID + "-cmdPressed";

// XXX Currently, only Firefox implements the inline preferences.
if (!require("xul-app").is("Firefox"))
  throw Error("This API is only supported in Firefox");

// Listen to clicks on buttons
function buttonClick(subject, data) {
  emit(target, data);
}
observers.add(BUTTON_PRESSED, buttonClick);

// Make sure we cleanup listeners on unload.
unload(function() {
  off(exports);
  observers.remove(BUTTON_PRESSED, buttonClick);
});

const prefs = Prefs(ADDON_BRANCH);

const target = EventTarget.extend({ prefs: prefs }).new();

// exporting the EventTarget so that one can emit events on it.
module.exports = target;

// Start observing preference changes
PrefsObserver({
  branchName: ADDON_BRANCH,
  target: target
});

// This is workaround making sure that exports is wrapped before it's
// frozen, which needs to happen in order to workaround Bug 673468.
off(target, 'workaround-bug-673468');
