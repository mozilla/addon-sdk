/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "deprecated"
};

const { setMode, getMode, on: onStateChange } = require('./private-browsing/utils');
const { emit, on, once, off } = require('./event/core');
const { when: unload } = require('./system/unload');
const { deprecateUsage, deprecateFunction, deprecateEvent } = require('./util/deprecate');

onStateChange('start', function onStart() {
  emit(exports, 'start');
});

onStateChange('stop', function onStop() {
  emit(exports, 'stop');
});

Object.defineProperty(exports, "isActive", {
	get: deprecateFunction(getMode, 'require("private-browsing").isActive is deprecated.')
});

exports.activate = deprecateFunction(
  function activate() setMode(true),
  'require("private-browsing").activate is deprecated.'
);
exports.deactivate = deprecateFunction(
  function deactivate() setMode(false),
  'require("private-browsing").deactivate is deprecated.'
);

exports.on = deprecateStartEvent(on.bind(null, exports));
exports.once = deprecateStartEvent(once.bind(null, exports));
exports.removeListener = deprecateStartEvent(function removeListener(type, listener) {
  // Note: We can't just bind `off` as we do it for other methods cause skipping
  // a listener argument will remove all listeners for the given event type
  // causing misbehavior. This way we make sure all arguments are passed.
  off(exports, type, listener);
});

function deprecateStartEvent(func) deprecateEvent(
  func,
   'The require("private-browsing") module\' "start" event is deprecated.',
  ['start']
);

// Make sure listeners are cleaned up.
unload(function() off(exports));
