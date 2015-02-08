/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cu } = require("chrome");
const Startup = require("sdk/addon/startup.jsm");
const LegacyStartup = Cu.import("resource://gre/modules/sdk/system/Startup.js", {}).exports;

exports["test startup initialized"] = function(assert) {
  assert.ok(Startup.initialized, "Startup.initialized is true");
  assert.ok(LegacyStartup.initialized, "LegacyStartup.initialized is true");
}

exports["test startup onceInitialized"] = function*(assert) {
  yield Startup.onceInitialized;
  assert.pass("Startup.onceInitialized promise was resolved");

  yield LegacyStartup.onceInitialized;
  assert.pass("LegacyStartup.onceInitialized promise was resolved");
}

require('sdk/test').run(exports);
