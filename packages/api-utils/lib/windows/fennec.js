/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { BrowserWindow } = require('api-utils/window/browser');
const windowUtils = require('api-utils/window-utils');
const { windowNS } = require('api-utils/window/namespace');
const { on, off, once, emit } = require("api-utils/event/core");
const { method } = require('../functional');
const { WindowTracker } = require('api-utils/window-utils');
const { isBrowser } = require('api-utils/window/utils');

const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec, consider using require("tabs") instead';

const windows = [];

// NOTE: On Fennec there is only one window.

const browserWindows = {
  get activeWindow() {
    let window = windowUtils.activeBrowserWindow;
    return window ? getBrowserWindow({window: window}) : null;
  },
  open: function open(options) {
    throw new Error(ERR_FENNEC_MSG);
    return null;
  },
  __iterator__: function __iterator__() {
    for (var i = 0, len = windows.length; i < len; i++)
      yield windows[i];
  },
  get length() {
    return windows.length;
  },
  on: method(on),
  once: method(once),
  off: method(off),
  removeListener: method(off),
};
exports.browserWindows = browserWindows;


/**
 * Gets a `BrowserWindow` for the given `chromeWindow` if previously
 * registered, `null` otherwise.
 */
function getRegisteredWindow(chromeWindow) {
  for each (let window in windows) {
    if (chromeWindow === windowNS(window).window)
      return window;
  }

  return null;
}

/**
 * Gets a `BrowserWindow` for the provided window options obj
 * @params {Object} options
 *    Options that are passed to the the `BrowserWindowTrait`
 * @returns {BrowserWindow}
 */
function getBrowserWindow(options) {
  let window = null;

  // if we have a BrowserWindow already then use it
  if ("window" in options)
    window = getRegisteredWindow(options.window);
  if (window)
    return window;

  // we don't have a BrowserWindow yet, so create one
  var window = BrowserWindow(options);
  windows.push(window);
  return window;
}

WindowTracker({
  onTrack: function onTrack(chromeWindow) {
    if (!isBrowser(chromeWindow)) return;
    let window = getBrowserWindow({ window: chromeWindow });
    emit(browserWindows, 'open', window);
  },
  onUntrack: function onUntrack(chromeWindow) {
    if (!isBrowser(chromeWindow)) return;
    let window = getBrowserWindow({ window: chromeWindow });
    emit(browserWindows, 'close', window);
  }
});
