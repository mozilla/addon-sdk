/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cc, Ci } = require("chrome");
const observers = require("observer-service");
const { EventEmitter } = require("events");
const unload = require("unload");
const prefService = require("preferences-service");
const { jetpackID } = require("@packaging");

const ADDON_BRANCH = "extensions." + jetpackID + ".";
const BUTTON_PRESSED = jetpackID + "-cmdPressed";

// XXX Currently, only Firefox implements the inline preferences.
if (!require("xul-app").is("Firefox"))
  throw Error("This API is only supported in Firefox");

let branch = Cc["@mozilla.org/preferences-service;1"].
             getService(Ci.nsIPrefService).
             getBranch(ADDON_BRANCH).
             QueryInterface(Ci.nsIPrefBranch2);

const events = EventEmitter.compose({
  constructor: function Prefs() {
    // Log unhandled errors.
    this.on("error", console.exception.bind(console));

    // Make sure we remove all the listeners
    unload.ensure(this);

    this._prefObserver = this._prefObserver.bind(this);
    this._buttonObserver = this._buttonObserver.bind(this);

    // Listen to changes in the preferences
    branch.addObserver("", this._prefObserver, false);

    // Listen to clicks on buttons
    observers.add(BUTTON_PRESSED, this._buttonObserver, this);
  },
  _prefObserver: function PrefsPrefObserver(subject, topic, prefName) {
    if (topic == "nsPref:changed") {
      this._emit(prefName, prefName);
    }
  },
  _buttonObserver: function PrefsButtonObserver(subject, data) {
    this._emit(data);
  },
  unload: function manager_unload() {
    this._removeAllListeners();
    branch.removeObserver("", this._prefObserver);
 },
})();

const simple = Proxy.create({
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

exports.on = events.on;
exports.removeListener = events.removeListener;
exports.prefs = simple;
