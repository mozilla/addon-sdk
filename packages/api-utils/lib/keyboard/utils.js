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
 * The Original Code is Jetpack Packages.
 *
 * The Initial Developer of the Original Code is Red Hat.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

const { Cc, Ci } = require("chrome");
const runtime = require("runtime");

// Key codes for non printable chars.
// @See: http://mxr.mozilla.org/mozilla-central/source/dom/interfaces/events/nsIDOMKeyEvent.idl
const DOM_VK_CODES = exports.DOM_VK_CODES = Ci.nsIDOMKeyEvent;

// Map of modifier key mappings.
const MODIFIERS = exports.MODIFIERS = {
  'accel': runtime.OS === "Darwin" ? 'meta' : 'control',
  'meta': 'meta',
  'control': 'control',
  'option': 'alt',
  'command': 'meta',
  'alt': 'alt',
  'shift': 'shift'
};

exports.getKeyForCode = function getKeyForCode(code) {
  for (let key in DOM_VK_CODES) {
    if (DOM_VK_CODES[key] === code) {
      return key.substr(7).              // Remove DOM_VK_ part.
                 replace(/_/g, '').      // Remove all the _ chars.
                 toLowerCase();          // Lover casing the rest.
    }
  }
};

exports.stringify = function stringify(key, modifiers) {
  let keys = modifiers.slice();
  keys.push(key);
  return keys.join(" ");
};
