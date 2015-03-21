/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

exports.testLogging = function(assert) {
  dump("START TRACKING LOGGING HERE");
  require("sdk/timers");
  dump("STOP TRACKING LOGGING HERE");
  assert.pass("done testing")
};

require("sdk/test/runner").runTestsFromModule(module);
