/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cc, Ci } = require('chrome');
const { defer } = require('api-utils/functional');
const { windowNS } = require('api-utils/window/namespace');
const globalPB = require('private-browsing');

let pbService;

// Currently, only Firefox implements the private browsing service.
if (require("api-utils/xul-app").is("Firefox")) {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);
}

let setPBMode = defer(function setPBMode(value, window) {
  // We toggle private browsing mode asynchronously in order to work around
  // bug 659629.  Since private browsing transitions are asynchronous
  // anyway, this doesn't significantly change the behavior of the API.
  value = !!value;

  if (window) {
    // is per-window private browsing implemented?
    let chromeWin = windowNS(window).window;
    if ("gPrivateBrowsingUI" in chromeWin
        && "privateWindow" in window.gPrivateBrowsingUI) {
      return gPrivateBrowsingUI.privateWindow = value;
    }
  }

  // default
  return pbService && (pbService.privateBrowsingEnabled = value);
});
exports.setMode = setPBMode;

let getMode = function getMode(window) {
  if (window) {
    // is per-window private browsing implemented?
    let chromeWin = windowNS(window).window;
    if ("gPrivateBrowsingUI" in chromeWin
        && "privateWindow" in window.gPrivateBrowsingUI) {
      return gPrivateBrowsingUI.privateWindow;
    }
  }

  // default
  return globalPB.isActive;
};
exports.getMode = getMode;
