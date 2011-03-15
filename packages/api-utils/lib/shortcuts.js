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
 *   Dietrich Ayala <dietrich@mozilla.com> (Original Author)
 *   Paul Vet <original.roju@gmail.com>
 *   Irakli Gozalishvili <gozala@mozilla.com>
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

const keyboardObserver = require("keyboard/observer");
const { MODIFIERS, getKeyForCode, stringify } = require("keyboard/utils");
const array = require("array");
const type = require("type");

const INVALID_SHORTCUT = "Shortcut string must contain one or more modifiers " +
                         "and only one key";
const SHORTCUTS = {};

function Shortcut(options) {
  // Making sure that function returns same thing regardless of `new` being used
  // with it.
  if (!(this instanceof Shortcut))
    return new Shortcut(options);

  if (type.isString(options)) {
    let elements = options.toLowerCase().split(' ');
    let modifiers = this.modifiers = [];
    elements.forEach(function(name) {
      if (name in MODIFIERS) {
        array.add(modifiers, MODIFIERS[name]);
      } else {
        if (!this.key)
          this.key = name;
        else
          throw new TypeError(INVALID_SHORTCUT);
      }
    }, this);
  } else {
    this.modifiers = array.unique(options.modifiers, []);
    this.key = String(options.key);
    if (onExecute in option)
      this.onExecute = options.onExecute;
  }

  this.modifiers = this.modifiers.sort();
  this.id = this.toString();

  SHORTCUTS[this.id] = this;
}
Shortcut.prototype.toString = function toString() {
  return stringify(this.key, this.modifiers);
};
Shortcut.prototype.toJSON = function toJSON() {
  return JSON.parse(JSON.stringify({
    modifiers: this.modifiers,
    key: this.key
  }));
};
exports.Shortcut = Shortcut;

function onKeypress(event, window) {
  let { which, keyCode, shiftKey, altKey, ctlKey, metaKey, isChar } = event;
  let key, modifiers = [];

  if (shiftKey)
    modifiers.push("shift");
  if (altKey)
    modifiers.push("alt");
  if (ctlKey)
    modifiers.push("control");
  if (metaKey)
    modifiers.push("meta");

  // If it's a printable character we just lower case it.
  if (isChar)
    key = String.fromCharCode(which).toLowerCase();
  // If it's not a printable character then we fall back to a human readable
  // equivalent of one of the following constants.
  // http://mxr.mozilla.org/mozilla-central/source/dom/interfaces/events/nsIDOMKeyEvent.idl
  // If event has a `keyCode` we use it to search a right name of the key,
  // otherwise we fall back to `which`.
  else
    key = getKeyForCode(keyCode || which)

  let id = stringify(key, modifiers.sort());

  console.log(id);
  let shortcut = SHORTCUTS[id];
  if (shortcut && shortcut.onExecute) {
    try {
      shortcut.onExecute();
    } catch (exception) {
      console.exception(exception);
    } finally {
      // Work around bug 582052 by preventing the (nonexistent) default action.
      e.preventDefault();
    }
  }
}

keyboardObserver.on("keypress", onKeypress);
