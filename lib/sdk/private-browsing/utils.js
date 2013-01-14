/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci, Cu } = require('chrome');
const { defer } = require('../lang/functional');
const { emit, on, once, off } = require('../event/core');
const { when: unload } = require('../system/unload');
const { getWindowLoadingContext, windows } = require('../window/utils');
const { deprecateFunction } = require('../util/deprecate');
const { WindowTracker } = require("../deprecated/window-utils");
const events = require('../system/events');
const isFF = require("../system/xul-app").is("Firefox");

let deferredEmit = defer(emit);
let pbService;
let pbWindowsActive = false;
let utils = {};

// get the nsIPrivateBrowsingService if it exists
try {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);

  // a dummy service exists for the moment, but will be removed eventually
  if (!('privateBrowsingEnabled' in pbService))
    pbService = undefined;
} catch(e) { /* Private Browsing Service has been removed (Bug 818800) */ }

try {
  Cu.import('resource://gre/modules/PrivateBrowsingUtils.jsm', utils);
}
catch(e) { /* if this file dne then an error will be thrown */ }

function isWindowPrivate(win) {
  // if the pbService is undefined, the PrivateBrowsingUtils.jsm is available,
  // and the app is Firefox, then assume per-window private browsing is
  // enabled.
  return !!(win && isFF && isWindowPBEnabled() &&
         utils.PrivateBrowsingUtils.isWindowPrivate(win));
}
exports.isWindowPrivate = isWindowPrivate;

// checks that per-window private browsing implemented
let isWindowPBEnabled = function isWindowPBEnabled() {
  return !pbService && 'PrivateBrowsingUtils' in utils;
}
exports.isWindowPBEnabled = isWindowPBEnabled;

// Currently, only Firefox implements the private browsing service.
if (isFF) {
  if (isWindowPBEnabled()) {
    WindowTracker({
      onTrack: function onTrack(chromeWindow) {
        if (isWindowPrivate(chromeWindow)) {
          if (!pbWindowsActive && getMode()) {
            pbWindowsActive = true;
            emit(exports, "start");
          }
        }
      },
      onUntrack: function onUntrack(chromeWindow) {
        if (isWindowPrivate(chromeWindow) && pbWindowsActive && !getMode()) {
          pbWindowsActive = false;
          emit(exports, "stop");
        }
      }
    });
  }
  else if (pbService) {
    // set up an observer for private browsing switches.
    events.on('private-browsing-transition-complete', function onChange() {
      // Emit event with in next turn of event loop.
      deferredEmit(exports, pbService.privateBrowsingEnabled ? 'start' : 'stop');
    });
  }
}

// We toggle private browsing mode asynchronously in order to work around
// bug 659629.  Since private browsing transitions are asynchronous
// anyway, this doesn't significantly change the behavior of the API.
let setMode = defer(function setMode(value) {
  value = !!value;  // Cast to boolean.

  // default
  return pbService && (pbService.privateBrowsingEnabled = value);
});
exports.setMode = deprecateFunction(
  setMode,
  'require("private-browsing").activate and require("private-browsing").deactivate ' +
  'is deprecated.'
);

let getMode = function getMode(chromeWin) {
  if (isWindowPrivate(chromeWin))
    return true;

  // if the per window private browsing feature is enabled,
  // then check all windows for a private browsing window
  let wins = windows();
  for each (let win in wins) {
    if (isWindowPrivate(win))
      return true;
  }

  // default
  return pbService ? pbService.privateBrowsingEnabled : false;
};
exports.getMode = getMode;

exports.on = on.bind(null, exports);

// Make sure listeners are cleaned up.
unload(function() off(exports));
