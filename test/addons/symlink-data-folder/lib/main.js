/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { data } = require('self');

exports.testData = function(assert) {
  assert.equal(data.load('index.html'), 'SYMLINK TEST DATA');
  assert.equal(require('extra').FOO, 'BAR');
};

require("sdk/test/runner").runTestsFromModule(module);
