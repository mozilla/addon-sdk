/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cc, Ci } = require('chrome');
const { defer } = require('api-utils/functional');
const observers = require('api-utils/observer-service');
const { emit, on, once, off } = require('api-utils/event/core');
const { when: unload } = require('api-utils/unload');

let deferredEmit = defer(emit);

let pbService;

// Currently, only Firefox implements the private browsing service.
if (require("api-utils/xul-app").is("Firefox")) {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);

  // set up an observer for private browsing switches.
  observers.add('private-browsing-transition-complete', function onChange() {
    // Emit event with in next turn of event loop.
    deferredEmit(exports, pbService.privateBrowsingEnabled ? 'start' : 'stop');
  });
}

// We toggle private browsing mode asynchronously in order to work around
// bug 659629.  Since private browsing transitions are asynchronous
// anyway, this doesn't significantly change the behavior of the API.
let setMode = defer(function setMode(value, chromeWin) {
  value = !!value;  // Cast to boolean.

  if (chromeWin) {
    // is per-window private browsing implemented?
    if ("gPrivateBrowsingUI" in chromeWin
        && "privateWindow" in chromeWin.gPrivateBrowsingUI) {
      return chromeWin.gPrivateBrowsingUI.privateWindow = value;
    }
  }

  // default
  return pbService && (pbService.privateBrowsingEnabled = value);
});
exports.setMode = setMode;

let getMode = function getMode(chromeWin) {
  if (chromeWin) {
    // is per-window private browsing implemented?
    if ("gPrivateBrowsingUI" in chromeWin &&
        "privateWindow" in chromeWin.gPrivateBrowsingUI) {
      return chromeWin.gPrivateBrowsingUI.privateWindow;
    }
  }

  // default
  return pbService ? pbService.privateBrowsingEnabled : false;
};
exports.getMode = getMode;

exports.on = on.bind(null, exports);

// Make sure listeners are cleaned up.
unload(function() off(exports));
