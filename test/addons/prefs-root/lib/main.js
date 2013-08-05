/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const simple = require('sdk/simple-prefs');
const service = require('sdk/preferences/service');
const { prefsRoot } = require('@loader/options');

exports.testPrefsRoot = function(assert) {
  assert.equal(prefsRoot, 'human-readable', 'prefsRoot is human-readable');

  assert.equal(simple.prefs.test42, false, 'test42 is false');

  simple.prefs.test43 = 'movie';
  assert.equal(service.get('extensions.human-readable.test43'), 'movie', 'test43 is a movie');
}

require('sdk/test/runner').runTestsFromModule(module);
