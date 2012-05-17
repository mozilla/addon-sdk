/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cc, Ci } = require("chrome");
const { emit, off } = require("api-utils/event/core");
const { Class } = require("api-utils/heritage");
const { EventTarget } = require("api-utils/event/target");
const { when: unload } = require("api-utils/unload");
const { id } = require("self");
const prefService = require("api-utils/preferences-service");
const observers = require("api-utils/observer-service");

const ADDON_BRANCH = "extensions." + id + ".";
const BUTTON_PRESSED = id + "-cmdPressed";

// XXX Currently, only Firefox implements the inline preferences.
if (!require("api-utils/xul-app").is("Firefox"))
  throw Error("This API is only supported in Firefox");

const branch = Cc["@mozilla.org/preferences-service;1"].
             getService(Ci.nsIPrefService).
             getBranch(ADDON_BRANCH).
             QueryInterface(Ci.nsIPrefBranch2);

// Listen to changes in the preferences
function preferenceChange(subject, topic, name) {
  if (topic === 'nsPref:changed')
    emit(target, name, name);
}
branch.addObserver('', preferenceChange, false);

// Listen to clicks on buttons
function buttonClick(subject, data) {
  emit(target, data);
}
observers.add(BUTTON_PRESSED, buttonClick);

// Make sure we cleanup listeners on unload.
unload(function() {
  off(exports);
  branch.removeObserver('', preferenceChange, false);
  observers.remove(BUTTON_PRESSED, buttonClick);
});

const prefs = Proxy.create({
  get: function(receiver, pref) {
    return prefService.get(ADDON_BRANCH + pref);
  },
  set: function(receiver, pref, val) {
    prefService.set(ADDON_BRANCH + pref, val);
  },
  delete: function(pref) {
    prefService.reset(ADDON_BRANCH + pref);
    return true;
  },
  has: function(pref) {
    return prefService.has(ADDON_BRANCH + pref);
  }
});

// Event target we will expose as module exports in order to be able to
// emit events on it.
const target = Class({
  extends: EventTarget,
  prefs: prefs
})();
module.exports = target;
