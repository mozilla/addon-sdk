/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { PrefsTarget } = require('api-utils/prefs/target');
const { get, set, reset } = require('api-utils/preferences-service');
const { Loader } = require('test-harness/loader');
const { setTimeout } = require('timers');

const root = PrefsTarget();

exports.testPrefTarget = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let pt = loader.require('api-utils/prefs/target').PrefsTarget({});
  let name = 'test';

  test.assertEqual(get(name, ''), '', 'test pref is blank');

  pt.once('test', function() {
    test.assertEqual(get(name), '2', 'test pref is 2');
    reset(name);
    test.assertEqual(get(name, ''), '', 'test pref is reset');

    pt.once('test', function() {
      test.fail('should not have heard a pref change');
    });
    loader.unload();
    root.once('test', function() {
      test.pass('test pref was changed');
      reset(name);

      // end test
      setTimeout(function() test.done());
    });
    set(name, '3');
  });

  set(name, '2');
};
