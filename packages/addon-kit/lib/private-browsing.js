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
const collection = require("collection");
const observers = require("observer-service");
const errors = require("errors");
const { EventEmitter } = require('events');
const { setTimeout } = require('timer');

const ON_START = 'start',
      ON_STOP = 'stop',
      ON_TRANSITION = 'private-browsing-transition-complete';

let pbService;
// Currently, only Firefox implements the private browsing service.
if (require("xul-app").is("Firefox")) {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);
}

const PrivateBrowsing = EventEmitter.compose({
  constructor: function PrivateBrowsing() {
    // We only need to add observers if pbService exists.
    this._emit = this._emit.bind(this);
    // report errors from listeners
    this.on('error', console.error);
    if (pbService) {
      observers.add(ON_TRANSITION, this.onTransition.bind(this));
      this._active = pbService.privateBrowsingEnabled;
    }
  },
  // We don't need to do anything with cancel here.
  onTransition: function onTransition() {
    let active = this._active = pbService.privateBrowsingEnabled;
    setTimeout(this._emit, 0, exports.active ? ON_START : ON_STOP);
  },
  get active() this._active,
  set active(value) {
    if (pbService) pbService.privateBrowsingEnabled = !!value
  },
  _active: null
})()

Object.defineProperty(exports, 'active', {
  get: function() PrivateBrowsing.active,
  set: function(value) PrivateBrowsing.active = value
});
exports.on = PrivateBrowsing.on;
exports.removeListener = PrivateBrowsing.removeListener;

