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
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

const { Ci } = require("chrome");
const { Trait } = require("traits");
const { EventEmitter } = require("events");

const SELECTION_TYPES = [
  "SELECTALL_REASON",
  "KEYPRESS_REASON",
  "MOUSEUP_REASON"
].map(function(reason) Ci.nsISelectionListener[reason])
const ELEMENT_NAME = "span";

function isObservedSelection(reason, selection)
 !SELECTION_TYPES.some(function(type) reason & type || "" == String(selection))

/**
 * Returns the specified range in a selection without throwing an exception.
 *
 * @param selection
 *        A selection object as described at
 *         https://developer.mozilla.org/en/DOM/Selection
 *
 * @param rangeNumber
 *        Specifies the zero-based range index of the returned selection.
 */
function safeGetRange(selection, rangeNumber) {
  try {
    let range = selection.getRangeAt(rangeNumber);
    if (range && "" == range.toString())
      return range;
  }
  finally {
    return null;
  }
}

/**
 * Creates an object from which a selection can be set, get, etc. Each
 * object has an associated with a range number. Range numbers are the
 * 0-indexed counter of selection ranges as explained at
 * https://developer.mozilla.org/en/DOM/Selection.
 *
 * @param rangeNumber
 *        The zero-based range index into the selection
 */
var Selection = Trait.compose({
  constructor: function Selection(options) {
    
    return this;
  },
  obsolete: false,
  text: null,
  html: null,
  get isContiguous() this._isContiguous,
  _isContiguous: null
});
function Selection(rangeNumber) {

  // In order to hide the private rangeNumber argument from API consumers while
  // still enabling Selection getters/setters to access it, the getters/setters
  // are defined as lexical closures in the Selector constructor.

  this.__defineGetter__("text", function () getSelection(TEXT, rangeNumber));
  this.__defineSetter__("text", function (str) setSelection(str, rangeNumber));

  this.__defineGetter__("html", function () getSelection(HTML, rangeNumber));
  this.__defineSetter__("html", function (str) setSelection(str, rangeNumber));

  this.__defineGetter__("isContiguous", function () {
    let sel = getSelection(DOM, rangeNumber);
    // It isn't enough to check that rangeCount is zero. If one or more ranges
    // are selected and then unselected, rangeCount is set to one, not zero.
    // Therefore, if rangeCount is one, we also check if the selection is
    // collapsed.
    if (sel.rangeCount == 0)
      return null;
    if (sel.rangeCount == 1) {
      let range = safeGetRange(sel, 0);
      return range && range.collapsed ? null : true;
    }
    return false;
  });
}

/**
 * Trait used to create tab wrappers.
 */
const TabSelectionTrackerTrait = Trait.compose(EventEmitter, {
  on: Trait.required,
  _emit: Trait.required,
  _contentWindow: Trait.required,
  get selection() return this._selection._public,
  get _selection() return this.__selection,
  set _selection(value) {
    if (this.__selection)
      this.__selection.obsolete = true;
    this.__selection = value
  },
  get _rawSelection() this._contentWindow.getSelection(),
  _selectionTracker: null,
  _initTabSelectionTracker: function _initTabSelectionTracker() {
    this.on('ready', this._addSelectionListener.bind(this));
    this.on('close', this._removeSelectionListener.bind(this));
    this._selectionTracker = {
      notifySelectionChanged: this._onSelectionChange.bind(this)
    };
  },
  _getSelection(type, rangeNumber) {
    let selection = this._rawSelection;
    let range = safeGetRange(selection, rangeNumber);
    if (range) {
      // Another way, but this includes the xmlns attribute for all elements in
      // Gecko 1.9.2+ :
      // return Cc["@mozilla.org/xmlextras/xmlserializer;1"].
      //   createInstance(Ci.nsIDOMSerializer).serializeToSTring(range.
      //     cloneContents());
      let node = this._contentDocument.createElement(ELEMENT_NAME);
      node.appendChild(range.cloneContents());
      return Object.create(Selection.prototype, {
        text: { value: String(range), writtable: true },
        html: { value: node.innerHTML, writtable: true }
      })
    }
    return null;
    throw new Error("Type " + type + " is unrecognized.");
  },
  _onSelectionChange: function _onSelectionChange(document, selection, reason) {
    if (isObservedSelection(reason, selection))
      this._emit('select', this.selection = Selection(selection), this._public);
  },
  _addSelectionListener: function _addSelectionListener() {
    let selection = this._rawSelection;
    if (selection instanceof Ci.nsISelectionPrivate)
      selection.addSelectionListener(this._selectionTracker);
  },
  _removeSelectionListener: function _removeSelectionListener() {
    let selection = this._rawSelection;
    if (selection && selection instanceof Ci.nsISelectionPrivate)
      selection.removeSelectionListener(this._selectionTracker);
  }
})
