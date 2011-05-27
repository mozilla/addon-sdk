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
 *  Paul O’Shannessy <paul@oshannessy.com>
 *  Irakli Gozalishvili <gozala@mozilla.com>
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

const {Cc,Ci} = require("chrome");
const observers = require("observer-service");
const { EventEmitter } = require("events");
const { setTimeout } = require("timer");
const unload = require("unload");

const ON_START = "start";
const ON_STOP = "stop";
const ON_TRANSITION = "private-browsing-transition-complete";

let pbService;
// Currently, only Firefox implements the private browsing service.
if (require("xul-app").is("Firefox")) {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);
}

function toggleMode(value) pbService.privateBrowsingEnabled = !!value

const privateBrowsing = EventEmitter.compose({
  constructor: function PrivateBrowsing() {
    // Binding method to instance since it will be used with `setTimeout`.
    this._emitOnObject = this._emitOnObject.bind(this);
    this.unload = this.unload.bind(this);
    // Report unhandled errors from listeners
    this.on("error", console.exception.bind(console));
    unload.ensure(this);
    // We only need to add observers if `pbService` exists.
    if (pbService) {
      observers.add(ON_TRANSITION, this.onTransition.bind(this));
      this._isActive = pbService.privateBrowsingEnabled;
    }
  },
  unload: function _destructor() {
    this._removeAllListeners(ON_START);
    this._removeAllListeners(ON_STOP);
  },
  // We don't need to do anything with cancel here.
  onTransition: function onTransition() {
    let isActive = this._isActive = pbService.privateBrowsingEnabled;
    setTimeout(this._emitOnObject, 0, exports, isActive ? ON_START : ON_STOP);
  },
  get isActive() this._isActive,
  set isActive(value) {
    if (pbService)
      // We toggle private browsing mode asynchronously in order to work around
      // bug 659629.  Since private browsing transitions are asynchronous
      // anyway, this doesn't significantly change the behavior of the API.
      setTimeout(toggleMode, 0, value);
  },
  _isActive: false
})()

Object.defineProperty(exports, "isActive", {
  get: function() privateBrowsing.isActive
});
exports.activate = function activate() privateBrowsing.isActive = true;
exports.deactivate = function deactivate() privateBrowsing.isActive = false;
exports.on = privateBrowsing.on;
exports.once = privateBrowsing.once;
exports.removeListener = privateBrowsing.removeListener;

