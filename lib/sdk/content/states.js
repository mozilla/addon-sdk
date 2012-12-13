/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Ci } = require("chrome");
const { defer } = require("../core/promise");
const { isFrame } = require("../frame/utils");
const events = require("../system/events");

function getInnerID(event) {
  return event.subject.QueryInterface(Ci.nsISupportsPRUint64).data;
}

function contentUnload(predicate) {
  /**
  Function takes `predicate` that is invoked every time `inner-window-destroyed`
  notification is dispatched until predicate returns `true`. Predicate function
  is passed inner window id of the document being destroyed. Function returns
  promise that is fulfilled with a inner window id of the document on which
  predicate returned `true`.
  **/
  return events.promise("inner-window-destroyed", predicate, getInnerID);
}
exports.contentUnload = contentUnload;

function getSubject() { return events.subject; }
function contentCreate(predicate) {
  /**
  Function takes `target` that is one of following:

    1. Frame (iframe or browser) element.
    2. DOM Document.
    3. DOM Window.

  And returns promise that is resolved with given `target` immediately after
  the root element of a document associated with `target` has been created.
  In case of frame it's document being loaded into it.
  **/

  return events.promise("document-element-inserted", predicate, getSubject);
}
exports.contentCreate = contentCreate;

function eventPromise(target, type, predicate, capture) {
  capture = capture || false
  let { promise, resolve } = defer();
  function handler(event) {
    if (predicate(event)) {
      target.removeEventListener(type, handler, capture)
      resolve(target)
    }
  }
  target.addEventListener(type, handler, capture);

  return promise;
}
exports.eventPromise = eventPromise;

function contentReady(target, capture) {
  /**
  Function takes `target` that is on of the following:

    1. Frame (iframe or browser) element.
    2. DOM Window.
    3. DOM Document.

  And returns promise that is resolve with a given `target` when document
  content associated with `target` is loaded. In case of frame it's content
  loaded into it.
  **/

  capture = capture || false;
  let { promise, resolve } = defer();
  target.addEventListener("DOMContentLoaded", function handler(event) {
    let document = target.contentDocument ||
                   target.document ||
                   target;

    if (event.target === document) {
      target.removeEventListener("DOMContentLoaded", handler, capture);
      resolve(target);
    }
  }, capture);
  return promise;
}
exports.contentReady = contentReady;

function contentLoad(target, capture) {
  /**
  Function takes `target` that is on of the following:

    1. Frame (iframe or browser) element.
    2. DOM Window.
    3. DOM Document.

  And returns promise that is resolve with a given `target` when document
  content associated with `target` has fully finished loading. In case of
  frame it's content loaded into it.
  **/

  // "load" events do not propagate to frames there for capture is made
  // `true` by default.
  capture = capture === void(0) && isFrame(target) ? true :
            capture || false;
  let { promise, resolve } = defer();
  target.addEventListener("load", function handler(event) {
    let document = target.contentDocument ||
                   target.document ||
                   target;

    if (event.target === document) {
      target.removeEventListener("load", handler, capture);
      resolve(target);
    }
  }, capture);
  return promise;
}
exports.contentLoad = contentLoad;
