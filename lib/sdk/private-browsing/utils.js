/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci } = require('chrome');
const { defer } = require('../lang/functional');
const observers = require('../deprecated/observer-service');
const { emit, on, once, off } = require('../event/core');
const { when: unload } = require('../system/unload');
const { getWindowLoadingContext } = require('../window/utils');
const { deprecateFunction } = require('../util/deprecate');

let deferredEmit = defer(emit);

let pbService;

// Currently, only Firefox implements the private browsing service.
if (require("../system/xul-app").is("Firefox")) {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);

  // set up an observer for private browsing switches.
  observers.add('private-browsing-transition-complete', function onChange() {
    // Emit event with in next turn of event loop.
    deferredEmit(exports, pbService.privateBrowsingEnabled ? 'start' : 'stop');
  });
}

// checks that per-window private browsing implemented
let isWindowPBEnabled = function isWindowPBEnabled(chromeWin) {
  return !!(chromeWin &&
         'gPrivateBrowsingUI' in chromeWin &&
         'privateWindow' in chromeWin.gPrivateBrowsingUI);
}
exports.isWindowPBEnabled = isWindowPBEnabled;

// We toggle private browsing mode asynchronously in order to work around
// bug 659629.  Since private browsing transitions are asynchronous
// anyway, this doesn't significantly change the behavior of the API.
// Note: this method should not be used with `chromeWin` argument until
//       the UI has been implemented. Bug 729865
let setMode = defer(function setMode(value, chromeWin) {
  value = !!value;  // Cast to boolean.

  if (isWindowPBEnabled(chromeWin))
    return getWindowLoadingContext(chromeWin).usePrivateBrowsing = value;

  // default
  return pbService && (pbService.privateBrowsingEnabled = value);
});
exports.setMode = deprecateFunction(
  setMode,
  'require("private-browsing").activate and require("private-browsing").deactivate ' +
  'is deprecated.'
);

let getMode = function getMode(chromeWin) {
  if (isWindowPBEnabled(chromeWin))
    return getWindowLoadingContext(chromeWin).usePrivateBrowsing;

  // default
  return pbService ? pbService.privateBrowsingEnabled : false;
};
exports.getMode = getMode;

exports.on = on.bind(null, exports);

// Make sure listeners are cleaned up.
unload(function() off(exports));
