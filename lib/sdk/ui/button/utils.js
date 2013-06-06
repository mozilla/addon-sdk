/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

// The Button module currently supports only Firefox.
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=jetpack-panel-apps
module.metadata = {
  'stability': 'stable',
  'engines': {
    'Firefox': '*'
  }
};

const { on, off, emit } = require("../../event/core");
const events = require("../../event/utils");
const { windows, isInteractive } = require('../../window/utils');
const { events: browserEvents } = require("../../browser/events");

const { getMostRecentBrowserWindow } = require("../../window/utils");

const { id: addonID } = require("sdk/self");

const { Cc, Ci } = require("chrome");
const styleSheetService = Cc["@mozilla.org/content/style-sheet-service;1"]
                        .getService(Ci.nsIStyleSheetService);
const io = Cc['@mozilla.org/network/io-service;1'].
            getService(Ci.nsIIOService);

/*
let url = io.newURI(encodeURI("data:text/css;charset=utf-8,\
  toolbarbutton[id^='button:" + addonID +"'] {\

  }"
  ), null, null);

styleSheetService.loadAndRegisterSheet(url, styleSheetService.USER_SHEET);
*/
//void loadAndRegisterSheet(in nsIURI sheetURI, in unsigned long type);
//boolean sheetRegistered(in nsIURI sheetURI, in unsigned long type);
//void unregisterSheet(in nsIURI sheetURI, in unsigned long type);

let interactiveWindows = windows('navigator:browser').filter(isInteractive);

let windowOpen = events.filter(browserEvents, function(e) e.type === "load");
let windowClose = events.filter(browserEvents, function(e) e.type === "close");

on(windowOpen, "data", function({target: window}){

});

on(windowClose, "data", function({target: window}){

});

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const SIZE = {
  "small": 16,
  "medium": 32,
  "large": 64
}

function createButton(id, document) {
  document = document || getMostRecentBrowserWindow().document;

  let container = document.getElementById("nav-bar");
  let button = document.createElementNS(XUL_NS, "toolbarbutton");

  let stack =   document.createElementNS(XUL_NS, "stack");
  let label = document.createElementNS(XUL_NS, "label");

  label.setAttribute("top", "-6");
  label.setAttribute("right", "-6");

  label.setAttribute("style", [
    "pointer-events: none",
    "color: rgba(255, 255, 255, 0.85)",
    "border-radius: 2px",
    "font-size: 10px",
    "padding: 0 2px",
    "font-weight: bold",
    "text-shadow: 0 1px rgba(0, 0, 0, 0.5)",
    "box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3)",
    "visibility: hidden"
  ].join(";"));

  stack.appendChild(button);
  stack.appendChild(label);

  container.appendChild(
    document.createElementNS(XUL_NS, "toolbaritem")
      .appendChild(stack).parentNode
  );


  button.className = "toolbarbutton-1";
  // not check for duplicates yet
  button.parentNode.id = "button:" + addonID + "-" + id;

  return button;
}

function make(id, windows) {
  if (windows)
    windows = [].concat(windows);
  else
    windows = interactiveWindows;

  return windows.map(function(window) createButton(id, window.document));
}
exports.make = make;

function takeList(fn) {
  return function(list, ...args) {
    [].concat(list).forEach(function(item) {
      fn.apply(null, [item].concat(args))
    });
  }
}

function disposeButton(button) {
  button.parentNode.parentNode.parentNode.removeChild(button.parentNode.parentNode)
}
exports.dispose = takeList(disposeButton);

function setButtonType(button, type) {
  button.setAttribute("type", type || "");
}
exports.setType = takeList(setButtonType);

function setButtonImage(button, image) {
  button.setAttribute("image", image);
}
exports.setImage = takeList(setButtonImage);

function setButtonLabel(button, label) {
  button.setAttribute("label", label);
  button.setAttribute("tooltiptext", label);
}
exports.setLabel = takeList(setButtonLabel);

function setButtonSize(button, size) {
  let width = SIZE[size] || 16;

  button.setAttribute("width", width);
}
exports.setSize = takeList(setButtonSize);

function setButtonDisabled(button, disabled) {
  button.setAttribute("disabled", disabled)
}
exports.setDisabled = takeList(setButtonDisabled);

function setButtonBadge(button, text, color) {
  let badge = button.nextElementSibling;

  badge.style.visibility = text === "" ? "hidden" : "visible";

  badge.textContent = text;
  badge.style.backgroundColor = color;
}
exports.setBadge = takeList(setButtonBadge);

function click(buttons) {
  let recentWindow = getMostRecentBrowserWindow();

  for (let button of buttons) {
    if (button.ownerDocument.defaultView === recentWindow) {
      button.click();
      break;
    }
  }
}
exports.click = click;
