/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Ci } = require("chrome");
const { getInnerId } = require("../window/utils");
const { defer } = require("../core/promise");
const { isFrame } = require("../frame/utils");
const events = require("../system/events");

function contentUnload(target) {
  /**
  Function takes `target` that is one of following:

    1. DOM Element in the document.
    2. DOM Document.
    3. Frame (iframe or browser) element.
    4. DOM window.

  And returns promise that is resolved with given `target` just before window
  associated with a `target` is destroyed. In case of frame it's a window
  currently loaded into it.
  **/
  let { promise, resolve } = defer();
  let window = target.window ||       // 1. DOM element in the window
             target.defaultView ||    // 2. DOM Document
             target.contentWindow ||  // 3. Frame with window in it
             target;                  // 4. DOMWindow itself.
  let innerID = getInnerId(window);
  events.on("inner-window-destroyed", function handler(event) {
    if (event.subject.QueryInterface(Ci.nsISupportsPRUint64).data === innerID) {
      events.off("inner-window-destroyed", handler);
      resolve(target);
    }
  });
  return promise;
}
exports.contentUnload = contentUnload;

function contentCreate(target) {
  /**
  Function takes `target` that is one of following:

    1. Frame (iframe or browser) element.
    2. DOM Document.
    3. DOM Window.

  And returns promise that is resolved with given `target` immediately after
  the root element of a document associated with `target` has been created.
  In case of frame it's document being loaded into it.
  **/

  let { promise, resolve } = defer();
  events.on("document-element-inserted", function handler(event) {
    let window = target.contentWindow ||
                 target.window ||
                 target;

    if (window && (window === event.subject.defaultView)) {
      events.off("document-element-inserted", handler);
      resolve(target);
    }
  });
  return promise;
}
exports.contentCreate = contentCreate;

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
