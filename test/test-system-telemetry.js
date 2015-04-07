/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { add } = require('sdk/system/telemetry');

exports.testAddInvalid = function(assert) {
  assert.throws(function() {
    add({
      name: 'UNKNOWN',
      value: 200
    });
  }, /options are invalid/, 'cannot add to unknown');

  assert.throws(function() {
    add({
      value: 200
    });
  }, /options are invalid/, 'cannot add to undefined');

  assert.throws(function() {
    add({
      name: null,
      value: 200
    });
  }, /options are invalid/, 'cannot add to null');

  assert.throws(function() {
    add({});
  }, /options are invalid/, 'cannot add with blank options');

  assert.throws(function() {
    add();
  }, /options are invalid/, 'cannot add with undefined options');
}

require('sdk/test').run(exports);
