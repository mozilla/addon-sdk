"use strict";

const DEF_RANGE_NUM = 0;
const ELEMENT_NAME = "span";
// The selection type HTML
const TYPE_HTML = 0x01;
// The selection type TEXT
const TYPE_TEXT = 0x02;
// The selection type DOM (internal use only)
const TYPE_DOM = 0x03;

const ERR_SET_NO_SELECTION = "It isn't possible to change the selection, as "
                             + "there isn't currently a selection"
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
function getSelection(type, window, rangeNumber) {
  let selection;
  try {
    selection = window.getSelection();
  }
  catch (e) {
    return null;
  }

  // Get the selected content as the specified type
  if (TYPE_DOM === type)
    return selection;
  else if (TYPE_TEXT === type) {
    let range = safeGetRange(selection, rangeNumber);
    return range ? range.toString() : null;
  }
  else if (TYPE_HTML === type) {
    let range = safeGetRange(selection, rangeNumber);
    // Another way, but this includes the xmlns attribute for all elements in
    // Gecko 1.9.2+ :
    // return Cc["@mozilla.org/xmlextras/xmlserializer;1"].
    //   createInstance(Ci.nsIDOMSerializer).serializeToSTring(range.
    //     cloneContents());
    if (!range)
      return null;
    let node = window.document.createElement(ELEMENT_NAME);
    node.appendChild(range.cloneContents());
    return node.innerHTML;
  }
  throw new Error("Type " + type + " is unrecognized.");
}
const getSelectionText = getSelection.bind(null, TYPE_TEXT);
exports.getSelectionText = getSelectionText;

const getSelectionHTML = getSelection.bind(null, TYPE_HTML);
exports.getSelectionHTML = getSelectionHTML;

const getSelectionDOM = getSelection.bind(null, TYPE_DOM);
exports.getSelectionDOM = getSelectionDOM;

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

exports.isContiguous = function isContiguous(window, rangeNumber) {
  let selection = getSelectionDOM(window, rangeNumber);
    // It isn't enough to check that rangeCount is zero. If one or more ranges
    // are selected and then unselected, rangeCount is set to one, not zero.
    // Therefore, if rangeCount is one, we also check if the selection is
    // collapsed.
    if (selection.rangeCount == 0)
      return null;
    if (selection.rangeCount == 1) {
      let range = safeGetRange(selection, 0);
      return range && range.collapsed ? null : true;
    }
    return false;
};

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
exports.setSelection = function setSelection(window, value, rangeNumber) {
    // Make sure we have a window context & that there is a current selection.
    // Selection cannot be set unless there is an existing selection.
    let range;
    try {
      range = window.getSelection().getRangeAt(rangeNumber || DEF_RANGE_NUM);
    }
    catch (e) {
      // Rethrow with a more developer-friendly message than the caught
      // exception.
      throw new Error(ERR_SET_NO_SELECTION);
    }
    // Get rid of the current selection and insert our own
    range.deleteContents();
    let node = window.document.createElement(ELEMENT_NAME);
    range.surroundContents(node);

    // Some relevant JEP-111 requirements:

    // Setting the text property replaces the selection with the value to
    // which the property is set and sets the html property to the same value
    // to which the text property is being set.

    // Setting the html property replaces the selection with the value to
    // which the property is set and sets the text property to the text version
    // of the HTML value.

    // This sets both the HTML and text properties.
    node.innerHTML = value;
};
