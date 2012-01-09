/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc, Ci} = require("chrome");
const errors = require("./errors");
const apiUtils = require("./api-utils");
const timer = require("./timer");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

let hostFrame, hostDocument, hiddenWindow, isHostFrameReady = false;

if (!require("./xul-app").isOneOf(["Firefox", "Fennec", "Thunderbird"])) {
  throw new Error([
    "The hidden-frame module currently supports only Firefox and Thunderbird. ",
    "In the future, we would like it to support other applications, however. ",
    "Please see https://bugzilla.mozilla.org/show_bug.cgi?id=546740 for more ",
    "information."
  ].join(""));
}

let appShellService = Cc["@mozilla.org/appshell/appShellService;1"].
                        getService(Ci.nsIAppShellService);
hiddenWindow = appShellService.hiddenDOMWindow;

if (!hiddenWindow) {
  throw new Error([
    "The hidden-frame module needs an app that supports a hidden window. ",
    "We would like it to support other applications, however. Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=546740 for more information."
  ].join(""));
}

// Check if we can use the hidden window itself to host our iframes.
// If it's not a suitable host, the hostFrame will be lazily created
// by the first HiddenFrame instance.
if (hiddenWindow.location.protocol == "chrome:" &&
    (hiddenWindow.document.contentType == "application/vnd.mozilla.xul+xml" ||
     hiddenWindow.document.contentType == "application/xhtml+xml")) {
  hostFrame = hiddenWindow;
  hostDocument = hiddenWindow.document;
  isHostFrameReady = true;
}

function setHostFrameReady() {
  hostDocument = hostFrame.contentDocument;
  hostFrame.removeEventListener("DOMContentLoaded", setHostFrameReady, false);
  isHostFrameReady = true;
}

// This cache is used to access friend properties between functions
// without exposing them on the public API.
let cache = [];

exports.HiddenFrame = apiUtils.publicConstructor(HiddenFrame);

function HiddenFrame(options) {
  options = options || {};
  let self = this;

  for each (let [key, val] in Iterator(apiUtils.validateOptions(options, {
    onReady: {
      is: ["undefined", "function", "array"],
      ok: function(v) {
        if (apiUtils.getTypeOf(v) === "array") {
          // make sure every item is a function
          return v.every(function (item) typeof(item) === "function")
        }
        return true;
      }
    }
  }))) {
    if (typeof(val) != "undefined")
      options[key] = val;
  }

  require("./collection").addCollectionProperty(this, "onReady");
  if (options.onReady)
    this.onReady.add(options.onReady);

  if (!hostFrame) {
    hostFrame = hiddenWindow.document.createElement("iframe");

    // ugly ugly hack. This is the most lightweight chrome:// file I could find on the tree
    // This hack should be removed by proper platform support on bug 565388
    hostFrame.setAttribute("src", "chrome://global/content/mozilla.xhtml");
    hostFrame.addEventListener("DOMContentLoaded", setHostFrameReady, false);

    hiddenWindow.document.body.appendChild(hostFrame);
  }

  this.toString = function toString() "[object Frame]";
}

exports.add = function JP_SDK_Frame_add(frame) {
  if (!(frame instanceof HiddenFrame))
    throw new Error("The object to be added must be a HiddenFrame.");

  // This instance was already added.
  if (cache.filter(function (v) v.frame === frame)[0])
    return frame;

  function createElement() {
    hostFrame.removeEventListener("DOMContentLoaded", createElement, false);

    let element = hostDocument.createElementNS(XUL_NS, "iframe");

    element.setAttribute("type", "content");
    hostDocument.documentElement.appendChild(element);

    /* Public API: hiddenFrame.element */
    frame.__defineGetter__("element", function () element);

    // Notify consumers that the frame is ready.
    function onReadyListener(event) {
      element.removeEventListener("DOMContentLoaded", onReadyListener, false);
      if (event.target == element.contentDocument) {
        for (let handler in frame.onReady)
          errors.catchAndLog(function () handler.call(frame))();
      }
    }
    element.addEventListener("DOMContentLoaded", onReadyListener, false);

    cache.push({
      frame: frame,
      element: element,
      unload: function unload() {
        hostDocument.documentElement.removeChild(element);
      }
    });
  }

  /* Begin element construction or schedule it for later */
  if (isHostFrameReady) {
    createElement();
  } else {
    hostFrame.addEventListener("DOMContentLoaded", createElement, false);
  }

  return frame;
}

exports.remove = function remove(frame) {
  if (!(frame instanceof HiddenFrame))
    throw new Error("The object to be removed must be a HiddenFrame.");

  let entry = cache.filter(function (v) v.frame === frame)[0];
  if (!entry)
    return;

  entry.unload();
  cache.splice(cache.indexOf(entry), 1);
}

require("./unload").when(function () {
  for each (let entry in cache.slice())
    exports.remove(entry.frame);

  if (hostFrame && hostFrame !== hiddenWindow)
    hiddenWindow.document.body.removeChild(hostFrame);
});
