/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cc, Ci } = require("chrome");
const errors = require("../deprecated/errors");
const { Class } = require("../core/heritage");
const { List, addListItem, removeListItem } = require("../util/list");
const { EventTarget } = require("../event/target");
const { emit } = require("../event/core");
const { create: makeFrame } = require("./utils");
const { defer } = require("../core/promise");
const { when: unload } = require("../system/unload");
const { validateOptions, getTypeOf } = require("../deprecated/api-utils");
const { window } = require("../addon/window");
const { fromIterator } = require("../util/array");
const { ns } = require('../core/namespace');

// This cache is used to access friend properties between functions
// without exposing them on the public API.
let cache = new Set();
let frames = ns();

function FrameOptions(options) {
  options = options || {}
  return validateOptions(options, FrameOptions.validator);
}
FrameOptions.validator = {
  onReady: {
    is: ["undefined", "function", "array"],
    ok: function(v) {
      if (getTypeOf(v) === "array") {
        // make sure every item is a function
        return v.every(function (item) typeof(item) === "function")
      }
      return true;
    }
  },
  onUnload: {
    is: ["undefined", "function"]
  }
};

var HiddenFrame = Class({
  extends: EventTarget,
  initialize: function initialize(options) {
    options = FrameOptions(options);
    EventTarget.prototype.initialize.call(this, options);
  },
  get element() {
    return frames(this).element;
  },
  toString: function toString() {
    return "[object Frame]"
  }
});
exports.HiddenFrame = HiddenFrame

function addHiddenFrame(frame) {
  if (!(frame instanceof HiddenFrame))
    throw Error("The object to be added must be a HiddenFrame.");

  // This instance was already added.
  if (cache.has(frame)) return frame;
  else cache.add(frame);

  let element = makeFrame(window.document, {
    nodeName: "iframe",
    type: "content",
    allowJavascript: true,
    allowPlugins: true,
    allowAuth: true,
  });
  frames(frame).element = element;

  // Store the handler in a WeakMap to unbind later, changed from
  // a `once` style binding to accomodate page redirects
  frames(frame).loadHandler = function handleDOMContentLoaded (event) {
    // "DOMContentLoaded" events from nested frames propagate up to target,
    // ignore events unless it's DOMContentLoaded for the given target.
    if (event.target === element || event.target === element.contentDocument)
      emit(frame, 'ready');
  }

  element.addEventListener('DOMContentLoaded', frames(frame).loadHandler, false);

  return frame;
}
exports.add = addHiddenFrame;

function removeHiddenFrame(frame) {
  if (!(frame instanceof HiddenFrame))
    throw Error("The object to be removed must be a HiddenFrame.");

  if (!cache.has(frame)) return;

  // Remove from cache before calling in order to avoid loop
  cache.delete(frame);

  let ns = frames(frame);
  ns.element.
    removeEventListener("DOMContentLoaded", ns.loadHandler, false);
  emit(frame, "unload")

  let element = frame.element
  if (element) element.parentNode.removeChild(element)
}
exports.remove = removeHiddenFrame;

unload(function() fromIterator(cache).forEach(removeHiddenFrame));
