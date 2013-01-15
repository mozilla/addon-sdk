/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { setMode, getMode, on: onStateChange } = require('./private-browsing/utils');
const { emit, on, once, off } = require('./event/core');
const { when: unload } = require('./system/unload');
const { deprecateUsage } = require('./util/deprecate');

onStateChange('start', function onStart() {
  emit(exports, 'start');
});

onStateChange('stop', function onStop() {
  emit(exports, 'stop');
});

Object.defineProperty(exports, "isActive", {
	get: function() {
      deprecateUsage('require("private-browsing").isActive is deprecated.');
	  return getMode();
    }
});
exports.activate = function activate() setMode(true);
exports.deactivate = function deactivate() setMode(false);
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.removeListener = function removeListener(type, listener) {
  // Note: We can't just bind `off` as we do it for other methods cause skipping
  // a listener argument will remove all listeners for the given event type
  // causing misbehavior. This way we make sure all arguments are passed.
  off(exports, type, listener);
};

// Make sure listeners are cleaned up.
unload(function() off(exports));
