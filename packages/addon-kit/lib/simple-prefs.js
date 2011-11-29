/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Hernan Rodriguez Colmeiro <colmeiro@gmail.com> (Original Author)
 *  Erik Vold <erikvvold@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
    this._removeAllListeners("error");
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
