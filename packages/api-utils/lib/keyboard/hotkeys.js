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
 *   Paul Vet <original.roju@gmail.com>
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
const { getKeyForCode, normalize } = require("keyboard/utils");

/**
 * Register a global `hotkey` that executes `listener` when the key combination
 * in `hotkey` is pressed. If more then one `listener` is registered on the same
 * key combination only last one will be executed.
 *
 * @param {string} hotkey
 *    Key combination in the format of 'modifier key'.
 *
 * Examples:
 *
 *     "accel s"
 *     "meta shift i"
 *     "control alt d"
 *
 * Modifier keynames:
 *
 *  - **shift**: The Shift key.
 *  - **alt**: The Alt key. On the Macintosh, this is the Option key. On
 *    Macintosh this can only be used in conjunction with another modifier,
 *    since `Alt+Letter` combinations are reserved for entering special
 *    characters in text.
 *  - **meta**: The Meta key. On the Macintosh, this is the Command key.
 *  - **control**: The Control key.
 *  - **accel**: The key used for keyboard shortcuts on the user's platform,
 *    which is Control on Windows and Linux, and Command on Mac. Usually, this
 *    would be the value you would use.
 *
 * @param {function} listener
 *    Function to execute when the `hotkey` is executed.
 */
exports.register = function register(hotkey, listener) {
  hotkey = normalize(hotkey);
  hotkeys[hotkey] = listener;
};

/**
 * Unregister a global `hotkey`. If passed `listener` is not the one registered
 * for the given `hotkey`, the call to this function will be ignored.
 *
 * @param {string} hotkey
 *    Key combination in the format of 'modifier key'.
 * @param {function} listener
 *    Function that will be invoked when the `hotkey` is pressed.
 */
exports.unregister = function unregister(hotkey, listener) {
  hotkey = normalize(hotkey);
  if (hotkeys[hotkey] === listener)
    delete hotkeys[hotkey];
};

/**
 * Map of hotkeys and associated functions.
 */
const hotkeys = exports.hotkeys = {};

keyboardObserver.on("keypress", function onKeypress(event, window) {
  let key, modifiers = [];
  let isChar = "isChar" in event && event.isChar;
  let which = "which" in event ? event.which : null;
  let keyCode = "keyCode" in event ? event.keyCode : null;

  if ("shiftKey" in event && event.shiftKey)
    modifiers.push("shift");
  if ("altKey" in event && event.altKey)
    modifiers.push("alt");
  if ("ctrlKey" in event && event.ctrlKey)
    modifiers.push("control");
  if ("metaKey" in event && event.metaKey)
    modifiers.push("meta");

  // If it's not a printable character then we fall back to a human readable
  // equivalent of one of the following constants.
  // http://mxr.mozilla.org/mozilla-central/source/dom/interfaces/events/nsIDOMKeyEvent.idl
  if (!isChar)
    key = getKeyForCode(keyCode);

  // If don't have a key yet then it's either printable character so we just
  // create a string from it's charcode. For some keys like "!" `isChar` is
  // `false` but it's still printable and that's also a case when
  // `getKeyForCode` returns `undefined`.
  if (!key)
    key = String.fromCharCode(which);


  let combination = normalize({ key: key, modifiers: modifiers });
  let hotkey = hotkeys[combination];

  if (hotkey) {
    try {
      hotkey();
    } catch (exception) {
      console.exception(exception);
    } finally {
      // Work around bug 582052 by preventing the (nonexistent) default action.
      event.preventDefault();
    }
  }
});
