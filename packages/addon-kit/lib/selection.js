/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "stable"
};

if (!require("api-utils/xul-app").is("Firefox")) {
  throw new Error([
    "The selection module currently supports only Firefox.  In the future ",
    "we would like it to support other applications, however.  Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=560716 for more information."
  ].join(""));
}

let { Ci, Cc } = require("chrome"),
    { setTimeout } = require("api-utils/timer"),
    { emit, off } = require("api-utils/event/core"),
    { Unknown } = require("api-utils/xpcom"),
    { Class, obscure } = require("api-utils/heritage"),
    { EventTarget } = require("api-utils/event/target"),
    observers = require("api-utils/observer-service"),
    { ns } = require("api-utils/namespace");

// When a document is not visible anymore the selection object is detached, and
// a new selection object is created when it becomes visible again.
// That makes the previous selection's listeners added previously totally
// useless – the listeners are not notified anymore.
// To fix that we're listening for `document-shown` event in order to add
// the listeners to the new selection object created.
//
// See bug 665386 for further details.

let selections = ns();

observers.add("document-shown", function (document) {
  var window = document.defaultView;

  // We are not interested in documents without valid defaultView
  if (!window)
    return;

  let selection = selections(window).selection;

  // We want to handle only the windows where we added selection's listeners
  if (selection) {
    let currentSelection = window.getSelection();

    // If the current selection for the window given is different from the one
    // stored in the namespace, we need to add the listeners again, and replace
    // the previous selection in our list with the new one.
    //
    // Notice that we don't have to remove the listeners from the old selection,
    // because is detached. An attempt to remove the listener, will raise an
    // error (see http://mxr.mozilla.org/mozilla-central/source/layout/generic/nsSelection.cpp#5343 )
    //
    // We ensure that the current selection is an instance of
    // `nsISelectionPrivate` before working on it, in case is `null`.
    if (currentSelection instanceof Ci.nsISelectionPrivate &&
      currentSelection !== selection) {

      currentSelection.addSelectionListener(SelectionListenerManager);
      selections(window).selection = currentSelection;
    }
  }
});

const windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].
                       getService(Ci.nsIWindowMediator);

// The selection type HTML
const HTML = 0x01;

// The selection type TEXT
const TEXT = 0x02;

// The selection type DOM (internal use only)
const DOM  = 0x03;

// A more developer-friendly message than the caught exception when is not
// possible change a selection.
const ERR_CANNOT_CHANGE_SELECTION =
  "It isn't possible to change the selection, as there isn't currently a selection";

const Selection = Class({
  /**
   * Creates an object from which a selection can be set, get, etc. Each
   * object has an associated with a range number. Range numbers are the
   * 0-indexed counter of selection ranges as explained at
   * https://developer.mozilla.org/en/DOM/Selection.
   *
   * @param rangeNumber
   *        The zero-based range index into the selection
   */
  initialize: function initialize(rangeNumber) {
    // In order to hide the private `rangeNumber` argument from API consumers
    // while still enabling Selection getters/setters to access it, we define
    // it as non enumerable, non configurable property. While consumers still
    // may discover it they won't be able to do any harm which is good enough
    // in this case.
    Object.defineProperties(this, {
      rangeNumber: {
        enumerable: false,
        configurable: false,
        value: rangeNumber
      }
    });
  },
  get text() { return getSelection(TEXT, this.rangeNumber); },
  set text(value) { setSelection(value, this.rangeNumber); },
  get html() { return getSelection(HTML, this.rangeNumber); },
  set html(value) { setSelection(value, this.rangeNumber); },
  get isContiguous() {
    let selection = getSelection(DOM);

    // If there are multiple ranges, the selection is definitely discontiguous.
    // It returns `false` also if there are no selection; and `true` if there is
    // a single non empty range, or a selection in a text field - contiguous or
    // not (text field selection APIs doesn't support multiple selections).

    if (selection.rangeCount > 1)
      return false;

    return !!(safeGetRange(selection, 0) || getElementWithSelection());
  }
});

/**
 * Returns the most recent content window
 */
function context() {
  // Overlay names should probably go into the xul-app module instead of here
  return windowMediator.getMostRecentWindow("navigator:browser").document.
    commandDispatcher.focusedWindow;
}

/**
 * Returns the current selection from most recent content window. Depending on
 * the specified |type|, the value returned can be a string of text, stringified
 * HTML, or a DOM selection object as described at
 * https://developer.mozilla.org/en/DOM/Selection.
 *
 * @param type
 *        Specifies the return type of the selection. Valid values are the one
 *        of the constants HTML, TEXT, or DOM.
 *
 * @param rangeNumber
 *        Specifies the zero-based range index of the returned selection.
 */
function getSelection(type, rangeNumber) {
  let window, selection;
  try {
    window = context();
    selection = window.getSelection();
  }
  catch (e) {
    return null;
  }

  // Get the selected content as the specified type
  if (type == DOM)
    return selection;
  else if (type == TEXT) {
    let range = safeGetRange(selection, rangeNumber);

    if (range)
      return range.toString();

    let node = getElementWithSelection(window);

    if (!node)
      return null;

    return node.value.substring(node.selectionStart, node.selectionEnd);
  }
  else if (type == HTML) {
    let range = safeGetRange(selection, rangeNumber);
    // Another way, but this includes the xmlns attribute for all elements in
    // Gecko 1.9.2+ :
    // return Cc["@mozilla.org/xmlextras/xmlserializer;1"].
    //   createInstance(Ci.nsIDOMSerializer).serializeToSTring(range.
    //     cloneContents());
    if (!range)
      return null;
    let node = window.document.createElement("span");
    node.appendChild(range.cloneContents());
    return node.innerHTML;
  }
  throw new Error("Type " + type + " is unrecognized.");
}

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
    if (!range || range.toString() == "")
      return null;
    return range;
  }
  catch (e) {
    return null;
  }
}

/**
 * Returns a reference of the DOM's active element for the window given, if it
 * supports the text field selection API and has a text selected.
 *
 * Note:
 *   we need this method because window.getSelection doesn't return a selection
 *   for text selected in a form field (see bug 85686)
 *
 * @param {nsIWindow} [window]
 *    A reference to a window
 */
function getElementWithSelection(window) {
  let element;

  try {
    element = (window || context()).document.activeElement;
  }
  catch (e) {
    element = null;
  }

  if (!element)
    return null;

  let { value, selectionStart, selectionEnd } = element;

  let hasSelection = typeof value === "string" &&
                      !isNaN(selectionStart) &&
                      !isNaN(selectionEnd) &&
                      selectionStart !== selectionEnd;

  return hasSelection ? element : null;
}
/**
 * Sets the current selection of the most recent content document by changing
 * the existing selected text/HTML range to the specified value.
 *
 * @param val
 *        The value for the new selection
 *
 * @param rangeNumber
 *        The zero-based range index of the selection to be set
 *
 */
function setSelection(val, rangeNumber) {
    // Make sure we have a window context & that there is a current selection.
    // Selection cannot be set unless there is an existing selection.
    let window, selection;

    try {
      window = context();
      selection = window.getSelection();
    }
    catch (e) {
      throw new Error(ERR_CANNOT_CHANGE_SELECTION);
    }

    let range = safeGetRange(selection, rangeNumber);

    if (range) {
      // Get rid of the current selection and insert our own
      range.deleteContents();
      let node = window.document.createElement("span");
      range.surroundContents(node);

      // Some relevant JEP-111 requirements:

      // Setting the text property replaces the selection with the value to
      // which the property is set and sets the html property to the same value
      // to which the text property is being set.

      // Setting the html property replaces the selection with the value to
      // which the property is set and sets the text property to the text version
      // of the HTML value.

      // This sets both the HTML and text properties.
      node.innerHTML = val;
    } else {
      let node = getElementWithSelection(window);

      if (!node)
        throw new Error(ERR_CANNOT_CHANGE_SELECTION);

      let { value, selectionStart, selectionEnd } = node;

      let newSelectionEnd = selectionStart + val.length;

      node.value = value.substring(0, selectionStart) +
                    val +
                    value.substring(selectionEnd, value.length);

      node.setSelectionRange(selectionStart, newSelectionEnd);
    }
}

function onLoad(event) {
  SelectionListenerManager.onLoad(event);
}

function onUnload(event) {
  SelectionListenerManager.onUnload(event);
}

function onSelect() {
  SelectionListenerManager.onSelect();
}

let SelectionListenerManager = Class({
  extends: Unknown,
  interfaces: [ 'nsISelectionListener' ],
  /**
   * This is the nsISelectionListener implementation. This function is called
   * by Gecko when a selection is changed interactively.
   *
   * We only pay attention to the SELECTALL, KEYPRESS, and MOUSEUP selection
   * reasons. All reasons are listed here:
   *
   * http://mxr.mozilla.org/mozilla1.9.2/source/content/base/public/
   *   nsISelectionListener.idl
   *
   * The other reasons (NO_REASON, DRAG_REASON, MOUSEDOWN_REASON) aren't
   * applicable to us.
   */
  notifySelectionChanged: function notifySelectionChanged(document, selection,
                                                          reason) {
    if (!["SELECTALL", "KEYPRESS", "MOUSEUP"].some(function(type) reason &
      Ci.nsISelectionListener[type + "_REASON"]) || selection.toString() == "")
        return;

    this.onSelect();
  },

  onSelect : function onSelect() {
    setTimeout(emit, 0, module.exports, "select");
  },

  /**
   * Part of the Tracker implementation. This function is called by the
   * tabs module when a browser is being tracked. Often, that means a new tab
   * has been opened, but it can also mean an addon has been installed while
   * tabs are already opened. In that case, this function is called for those
   * already-opened tabs.
   *
   * @param browser
   *        The browser being tracked
   */
  onTrack: function onTrack(browser) {
    browser.addEventListener("load", onLoad, true);
    browser.addEventListener("unload", onUnload, true);
  },

  onLoad: function onLoad(event) {
    // Nothing to do without a useful window
    let window = event.target.defaultView;
    if (!window)
      return;

    // Wrap the add selection call with some number of setTimeout 0 because some
    // reason it's possible to add a selection listener "too early". 2 sometimes
    // works for gmail, and more consistently with 3, so make it 5 to be safe.
    let count = 0;
    let self = this;
    function wrap(count, func) {
      if (count-- > 0)
        setTimeout(wrap, 0);
      else
        self.addSelectionListener(window);
    }
    wrap();
  },

  addSelectionListener: function addSelectionListener(window) {
    // Don't add the selection's listener more than once to the same window.
    if ("selection" in selections(window))
      return;

    let selection = window.getSelection();

    // We ensure that the current selection is an instance of
    // `nsISelectionPrivate` before working on it, in case is `null`.
    if (selection instanceof Ci.nsISelectionPrivate) {
      selection.addSelectionListener(this);

      // nsISelectionListener implementation seems not fire a notification if
      // a selection is in a text field, therefore we need to add a listener to
      // window.onselect, that is fired only for text fields.
      // For consistency, we add it only when the nsISelectionListener is added.
      //
      // https://developer.mozilla.org/en/DOM/window.onselect
      window.addEventListener("select", onSelect, true);

      selections(window).selection = selection;
    }
  },

  onUnload: function onUnload(event) {
    // Nothing to do without a useful window
    let window = event.target.defaultView;
    if (!window)
      return;
    this.removeSelectionListener(window);
    off(exports);
  },

  removeSelectionListener: function removeSelectionListener(window) {
    // Don't remove the selection's listener to a window that wasn't handled.
    if (!("selection" in selections(window)))
      return;

    let selection = window.getSelection();

    // We ensure that the current selection is an instance of
    // `nsISelectionPrivate` before working on it, in case is `null`.
    if (selection instanceof Ci.nsISelectionPrivate) {
      selection.removeSelectionListener(this);

      window.removeEventListener("select", onSelect);

      delete selections(window).selection;
    }
  },

  /**
   * Part of the TabTracker implementation. This function is called by the
   * tabs module when a browser is being untracked. Usually, that means a tab
   * has been closed.
   *
   * @param browser
   *        The browser being untracked
   */
  onUntrack: function onUntrack(browser) {
    browser.removeEventListener("load", onLoad, true);
    browser.removeEventListener("unload", onUnload, true);
  }
})();

/**
 * Install |SelectionListenerManager| as tab tracker in order to watch
 * tab opening/closing
 */
require("api-utils/tab-browser").Tracker(SelectionListenerManager);

var SelectionIterator = Class(obscure({
  /**
   * Exports an iterator so that discontiguous selections can be iterated.
   *
   * If discontiguous selections are in a text field, only the first one
   * is returned because the text field selection APIs doesn't support
   * multiple selections.
   */
  __iterator__: function() {
    let selection = getSelection(DOM);
    let count = selection.rangeCount || (getElementWithSelection() ? 1 : 0);

    for (let i = 0; i < count; i++)
      yield Selection(i);
  }
}));

var selection = Class({
  extends: EventTarget,
  implements: [ Selection, SelectionIterator ]
})(0);

module.exports = selection;
