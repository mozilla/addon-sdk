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

const { Cc, Ci } = require("chrome");
const runtime = require("runtime");
const { isString } = require("type");
const array = require("array");


const SWP = "{{SEPARATOR}}";
const SEPARATOR = "-"
const INVALID_COMBINATION = "Hotkey key combination must contain one or more " +
                            "modifiers and only one key";

// Key codes for non printable chars.
// @See: http://mxr.mozilla.org/mozilla-central/source/dom/interfaces/events/nsIDOMKeyEvent.idl
const DOM_VK_CODES = exports.DOM_VK_CODES = Ci.nsIDOMKeyEvent;

// Map of modifier key mappings.
const MODIFIERS = exports.MODIFIERS = {
  'accel': runtime.OS === "Darwin" ? 'meta' : 'control',
  'meta': 'meta',
  'control': 'control',
  'ctrl': 'control',
  'option': 'alt',
  'command': 'meta',
  'alt': 'alt',
  'shift': 'shift'
};

// Map of keys that contain `_` chars.
const ALIAS_KEYS = exports.KEYS = {
  'backspace': DOM_VK_CODES.BACK_SPACE,
  'capslock': DOM_VK_CODES.CAPS_LOCK,
  'pageup': DOM_VK_CODES.PAGE_UP,
  'pagedown': DOM_VK_CODES.PAGE_DOWN,
  'numlock': DOM_VK_CODES.NUM_LOCK,
  'scrolllock': DOM_VK_CODES.SCROLL_LOCK
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

exports.getCodeForKey = function getCodeForKey(key) {
  return key in ALIAS_KEYS ? ALIAS_KEYS[key] :
         (key = "DOM_VK_" + key.toUpperCase()) in DOM_VK_CODES ?
         DOM_VK_CODES[key] : undefined;
};

/**
 * Utility function that takes string or JSON that defines a `hotkey` and
 * returns normalized string version of it.
 * @param {JSON|String} hotkey
 * @param {String} [separator=" "]
 *    Optional string that represents separator used to concatenate keys in the
 *    given `hotkey`.
 * @returns {String}
 * @examples
 *
 *    require("keyboard/hotkeys").normalize("b Shift accel");
 *    // 'control shift b' -> on windows & linux
 *    // 'meta shift b'    -> on mac
 *    require("keyboard/hotkeys").normalize("alt-d-shift", "-");
 *    // 'alt shift d'
 */
var normalize = exports.normalize = function normalize(hotkey, separator) {
  if (!isString(hotkey))
    hotkey = toString(hotkey, separator);
  return toString(toJSON(hotkey, separator), separator);
};

/*
 * Utility function that splits a string of characters that defines a `hotkey`
 * into modifier keys and the defining key.
 * @param {String} hotkey
 * @param {String} [separator=" "]
 *    Optional string that represents separator used to concatenate keys in the
 *    given `hotkey`.
 * @returns {JSON}
 * @examples
 *
 *    require("keyboard/hotkeys").toJSON("accel shift b");
 *    // { key: 'b', modifiers: [ 'control', 'shift' ] } -> on windows & linux
 *    // { key: 'b', modifiers: [ 'meta', 'shift' ] }    -> on mac
 *
 *    require("keyboard/hotkeys").normalize("alt-d-shift", "-");
 *    // { key: 'd', modifiers: [ 'alt', 'shift' ] }
 */
var toJSON = exports.toJSON = function toJSON(hotkey, separator) {
  separator = separator || SEPARATOR;
  // Since default separator is `-`, combination may take form of `alt--`. To
  // avoid misbehavior we replace `--` with `-{{SEPARATOR}}` where
  // `{{SEPARATOR}}` can be swapped later.
  hotkey = hotkey.toLowerCase().replace(separator + separator, separator + SWP);

  let value = {};
  let modifiers = [];
  let keys = hotkey.split(separator);
  keys.forEach(function(name) {
    // If name is `SEPARATOR` than we swap it back.
    if (name === SWP)
      name = separator;
    if (name in MODIFIERS) {
      array.add(modifiers, MODIFIERS[name]);
    } else {
      if (!value.key)
        value.key = name;
      else
        throw new TypeError(INVALID_COMBINATION);
    }
  });

  if (!value.key)
      throw new TypeError(INVALID_COMBINATION);

  value.modifiers = modifiers.sort();
  return value;
};

/**
 * Utility function that takes object that defines a `hotkey` and returns
 * string representation of it.
 *
 * _Please note that this function does not validates data neither it normalizes
 * it, if you are unsure that data is well formed use `normalize` function
 * instead.
 *
 * @param {JSON} hotkey
 * @param {String} [separator=" "]
 *    Optional string that represents separator used to concatenate keys in the
 *    given `hotkey`.
 * @returns {String}
 * @examples
 *
 *    require("keyboard/hotkeys").toString({
 *      key: 'b',
 *      modifiers: [ 'control', 'shift' ]
 *    }, '+');
 *    // 'control+shift+b
 *
 */
var toString = exports.toString = function toString(hotkey, separator) {
  let keys = hotkey.modifiers.slice();
  keys.push(hotkey.key);
  return keys.join(separator || SEPARATOR);
};
