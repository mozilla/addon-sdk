/* vim:set ts=2 sw=2 sts=2 et: */
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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
 *   Henri Wiechers <hwiechers@gmail.com>
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

"use strict";

const INVALID_HOTKEY = "Hotkey must have at least one modifier.";

const { toJSON: jsonify, toString: stringify } = require("keyboard/utils");
const { register, unregister } = require("keyboard/hotkeys");

const Hotkey = exports.Hotkey = function Hotkey(options) {
  if (!(this instanceof Hotkey))
    return new Hotkey(options);

  // Parsing key combination string.
  let hotkey = jsonify(options.combo);
  if (!hotkey.modifiers.length) {
    throw new TypeError(INVALID_HOTKEY);
  }

  this.onPress = options.onPress;
  this.toString = stringify.bind(null, hotkey);
  // Registering listener on keyboard combination enclosed by this hotkey.
  // Please note that `this.toString()` is a normalized version of
  // `options.combination` where order of modifiers is sorted and `accel` is
  // replaced with platform specific key.
  register(this.toString(), this.onPress);
  // We freeze instance before returning it in order to make it's properties
  // read-only.
  return Object.freeze(this);
};
Hotkey.prototype.destroy = function destroy() {
  unregister(this.toString(), this.onPress);
};
