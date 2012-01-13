/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc,Ci} = require("chrome");
const observers = require("api-utils/observer-service");
const { EventEmitter } = require("api-utils/events");
const { setTimeout } = require("api-utils/timer");
const unload = require("api-utils/unload");

const ON_START = "start";
const ON_STOP = "stop";
const ON_TRANSITION = "private-browsing-transition-complete";

let pbService;
// Currently, only Firefox implements the private browsing service.
if (require("api-utils/xul-app").is("Firefox")) {
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
    this._removeAllListeners();
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

