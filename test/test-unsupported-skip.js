/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const app = require('sdk/system/xul-app');
const packaging = require('@loader/options');

/*
 * Include a module that is unsupported for the current system.
 * The `Unsupported Application` error should be caught by the test loader
 * and no errors should occur
 */
if (!app.is('Firefox')) {
  require('./fixtures/loader/unsupported/firefox');
}
else {
  require('./fixtures/loader/unsupported/fennec');
}

exports.testRunning = function (assert) {
  assert.fail('Tests should not run in unsupported applications');
};

if (packaging.isNative) {
  module.exports = {
    "test skip on jpm": (assert) => assert.pass("skipping this file with jpm")
  };
}

require('sdk/test').run(exports);
