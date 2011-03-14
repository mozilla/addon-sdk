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

const {Cc,Ci} = require("chrome");
let windowUtils = require("window-utils");
let apiutils = require("api-utils");

let modifiers = {
  "ALT": Ci.nsIDOMKeyEvent.DOM_VK_ALT,
  "SHIFT": Ci.nsIDOMKeyEvent.DOM_VK_SHIFT,
  "CONTROL": Ci.nsIDOMKeyEvent.DOM_VK_CONTROL,
  "META": Ci.nsIDOMKeyEvent.DOM_VK_META
};

let shortcuts = {

    _handlers: new Array(),

  // nsIDOMEventListener
  handleEvent: function (aEvent) {
      //console.log ("mostrecenttab: shortcuts: got event: which=" + aEvent.which + ", type=" + aEvent.type);
    switch (aEvent.type) {
      case "keypress":
        this._onKeyPress(aEvent);
        break;
    }
  },

  _onKeyPress: function (aEvent) {
      //console.log ("mostrecenttab: shortcuts: _onKeyPress");
      let windows = require("windows").browserWindows;
      let whichKey = aEvent.which;
      let shiftKey = aEvent.shiftKey;
      let altKey = aEvent.altKey;
      let ctlKey = aEvent.ctrlKey;
      let metaKey = aEvent.metaKey;

      //console.log ("mostrecenttab: shortcuts: Calling this.findMatches");

      let matches = this._findMatches(whichKey, shiftKey, altKey, ctlKey, metaKey);
      if (matches) {
    //console.log ("mostrecenttab: shortcuts: matches found");
    
    matches.every(function(e,i,a){
        //console.log ("mostrecenttab: shortcuts: Calling handler");
        e.handler();
        
        // Work around bug 582052 by preventing the (nonexistent) default action.
        aEvent.preventDefault();

        return false;
    });
      }
  },

  _findMatches: function (whichKey, shiftKey, altKey, ctlKey, metaKey) {
      //console.log ("mostrecenttab: shortcuts: searching " + this._handlers.length + " handlers");
      return this._handlers.filter(function(e,i,a) {
    if (e.key.charCodeAt(0) === whichKey) {
        if (e.modifiers.every(function(mod) {
      switch (mod) {
      case "ALT": return altKey;
      case "SHIFT": return shiftKey;
      case "CONTROL": return ctlKey;
      case "META": return metaKey;
      };}))
        {
      //console.log ("mostrecenttab: shortcuts: key match");
      return true;
        }
    }
    return false;
      });
  },

    /** Register a keyboard shortcut.
  @arg options An object with values
    key: the key to use. e.g. "`"
    modifiers: an array with zero or more of the strings "SHIFT", "ALT", "CONTROL", "META"
    handler: the function to call when the shortcut is pressed
  */
  register: function (options) {
    options = apiutils.validateOptions(options, {
      key: {
        is: ["string"],
        ok: function (v) v.length > 0,
        msg: "The shortcut must have a non-empty key property."
      },
      modifiers: {
        is: ["array", "null", "undefined"],
        ok: function (v) v.every(function(m) modifiers[m]),
        msg: "The shortcut modifier property contains an invalid value."
      },
      handler: {
        is: ["function"],
        msg: "The shortcut must have a non-empty handler property."
      },
    });

      this._handlers.push (options);
  },

    /** Called to unload the module. Clears the list of shortcuts.
     */
  unload: function () {
      _handlers = null;
  }
};
require("unload").ensure(shortcuts);

let windowTracker = new windowUtils.WindowTracker({
  onTrack: function(aWindow) {
    aWindow.addEventListener("keypress", shortcuts, false);
  },
  onUntrack: function(aWindow) {
    aWindow.removeEventListener("keypress", shortcuts, false);
  }
});
require("unload").ensure(windowTracker);


/** Register a keyboard shortcut.
    @arg options An object with values
    key: the key to use. e.g. "`"
    modifiers: an array with zero or more of the strings "SHIFT", "ALT", "CONTROL", "META"
    handler: the function to call when the shortcut is pressed
*/
exports.register = function (options) {
    return shortcuts.register(options);
}
