/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { emit, off } = require("api-utils/event/core");
const { when: unload } = require("api-utils/unload");
const { PrefsTarget } = require("api-utils/prefs/target");
const { jetpackID } = require("@packaging");
const observers = require("api-utils/observer-service");

const ADDON_BRANCH = "extensions." + jetpackID + ".";
const BUTTON_PRESSED = jetpackID + "-cmdPressed";

// XXX Currently, only Firefox implements the inline preferences.
if (!require("xul-app").is("Firefox"))
  throw Error("This API is only supported in Firefox");

const target = PrefsTarget({ branchName: ADDON_BRANCH });

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

module.exports = target;

// This is workaround making sure that exports is wrapped before it's
// frozen, which needs to happen in order to workaround Bug 673468.
off(target, 'workaround-bug-673468');
