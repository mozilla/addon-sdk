/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader } = require("sdk/test/loader");
const { getMostRecentBrowserWindow, getInnerId } = require("sdk/window/utils");
const { openTab, closeTab, getBrowserForTab } = require("sdk/tabs/utils");
const { defer } = require("sdk/core/promise");
const { curry, identity, partial } = require("sdk/lang/functional");

let when = curry(function(options, tab) {
  let type = options.type || options;
  let capture = options.captuer || false;
  let target = getBrowserForTab(tab);
  let { promise, resolve } = defer();

  target.addEventListener(type, function handler(event) {
    if (!event.target.defaultView.frameElement) {
      target.removeEventListener(type, handler, capture);
      resolve(tab);
    }
  }, capture);

  return promise;
});

let use = function(value) function() value;


let open = curry(function(url, window) openTab(window, url));
let close = function(tab) {
  let promise = when("pagehide", tab);
  closeTab(tab);
  return promise;
}

exports["test multiple tabs"] = function(assert, done) {
  let loader = Loader(module);
  let { events } = loader.require("sdk/content/events");
  let { on, off } = loader.require("sdk/event/core");
  let actual = [];
  on(events, "data", function({type, target, timeStamp}) {
    // ignore about:blank pages.
    if (target.URL !== "about:blank") actual.push(type + " -> " + target.URL)
  });

  let window =  getMostRecentBrowserWindow();
  let firstTab = open("data:text/html,first-tab", window);

  when("pageshow", firstTab).
    then(close).
    then(use(window)).
    then(open("data:text/html,second-tab")).
    then(when("pageshow")).
    then(close).
    then(function() {
      assert.deepEqual(actual, [
        "document-element-inserted -> data:text/html,first-tab",
        "DOMContentLoaded -> data:text/html,first-tab",
        "load -> data:text/html,first-tab",
        "pageshow -> data:text/html,first-tab",
        "document-element-inserted -> data:text/html,second-tab",
        "DOMContentLoaded -> data:text/html,second-tab",
        "load -> data:text/html,second-tab",
        "pageshow -> data:text/html,second-tab"
      ], "all events dispatche as expeced")
    }, function(reason) {
      assert.fail(Error(reason));
    }).then(function() {
      loader.unload();
      done();
    });
};

exports["test nested frames"] = function(assert, done) {
  let loader = Loader(module);
  let { events } = loader.require("sdk/content/events");
  let { on, off } = loader.require("sdk/event/core");
  let actual = [];
  on(events, "data", function({type, target, timeStamp}) {
    // ignore about:blank pages.
    if (target.URL !== "about:blank") actual.push(type + " -> " + target.URL)
  });

  let window =  getMostRecentBrowserWindow();
  let uri = encodeURI("data:text/html,<iframe src='data:text/html,iframe'>");
  let tab = open(uri, window);

  when("pageshow", tab).
    then(close).
    then(function() {
      assert.deepEqual(actual, [
        "document-element-inserted -> " + uri,
        "content-document-global-created -> data:text/html,iframe",
        "DOMContentLoaded -> " + uri,
        "document-element-inserted -> data:text/html,iframe",
        "DOMContentLoaded -> data:text/html,iframe",
        "load -> data:text/html,iframe",
        "pageshow -> data:text/html,iframe",
        "load -> " + uri,
        "pageshow -> " + uri
      ], "events where dispatched")
    }, function(reason) {
      assert.fail(Error(reason))
    }).then(function() {
      loader.unload();
      done();
    });
};

require("test").run(exports);
