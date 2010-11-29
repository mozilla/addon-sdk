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
const selectionUtils = require("utils/selection");

const SELECTION_TYPES = [
  "SELECTALL_REASON",
  "KEYPRESS_REASON",
  "MOUSEUP_REASON"
].map(function(reason) Ci.nsISelectionListener[reason])

function isObservedSelection(reason, selection)
 !SELECTION_TYPES.some(function(type) reason & type || "" == String(selection))

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
  constructor: function Selection(tab) {
    this._tab = tab;
    return this;
  },
  get text() selectionUtils.getSelectionText(this._tab._contentWindow),
  set text(value) selectionUtils.setSelection(this._tab._contentWindow, value),
  get html() selectionUtils.getSelectionHTML(this._tab._contentWindow),
  set html(value) selectionUtils.setSelection(this._tab._contentWindow, value),
  get isContiguous() selectionUtils.isContiguous(this._tab._contentWindow)
});

/**
 * Trait used to create tab wrappers.
 */
exports.TabSelectionTrackerTrait = Trait.compose(EventEmitter, {
  on: Trait.required,
  _emit: Trait.required,
  _contentWindow: Trait.required,
  get selection() this._selection,
  _selection: null,
  _selectionTracker: null,
  _initTabSelectionTracker: function _initTabSelectionTracker() {
    this.on('ready', this._addSelectionListener.bind(this));
    this.on('close', this._removeSelectionListener.bind(this));
    this._selectionTracker = {
      notifySelectionChanged: this._onSelectionChange.bind(this)
    };
    this._selection = Selection(this);
  },
  _onSelectionChange: function _onSelectionChange(document, selection, reason) {
    if (isObservedSelection(reason, selection))
      this._emit('select', this.selection, this._public);
  },
  _addSelectionListener: function _addSelectionListener() {
    let selection = this._contentWindow.getSelection();
    if (selection instanceof Ci.nsISelectionPrivate)
      selection.addSelectionListener(this._selectionTracker);
  },
  _removeSelectionListener: function _removeSelectionListener() {
    let selection = this._contentWindow.getSelection();
    if (selection && selection instanceof Ci.nsISelectionPrivate)
      selection.removeSelectionListener(this._selectionTracker);
  }
})
