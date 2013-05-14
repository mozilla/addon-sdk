/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 'use strict';

Object.defineProperty(this, "global", { value: this });

const { merge } = require('sdk/util/object');
const { getTimerTests } = require('./timers/suite');
const { Loader } = require('sdk/test/loader');

exports.testGlobals = function(test) {
  // the only globals in module scope should be:
  //   module, exports, require, dump, console
  test.assertObject(module, "have 'module', good");
  test.assertObject(exports, "have 'exports', good");
  test.assertFunction(require, "have 'require', good");
  test.assertFunction(dump, "have 'dump', good");
  test.assertObject(console, "have 'console', good");

  test.assertFunction(setTimeout, "have 'setTimeout', good");
  test.assertFunction(clearTimeout, "have 'clearTimeout', good");
  test.assertFunction(setInterval, "have 'setInterval', good");
  test.assertFunction(clearInterval, "have 'clearInterval', good");

  // in particular, these old globals should no longer be present
  test.assert(!('packaging' in global), "no 'packaging', good");
  test.assert(!('memory' in global), "no 'memory', good");

  test.assertMatches(module.uri, /test-globals\.js$/,
                     'should contain filename');
};

merge(module.exports, getTimerTests(global));

exports.testUnload = function(test) {
  test.waitUntilDone();

  var loader = Loader(module);
  var sbtimer = loader.require("sdk/system/globals");

  var myFunc = function myFunc() {
    test.fail("myFunc() should not be called in testUnload");
  };

  sbtimer.setTimeout(myFunc, 1);
  sbtimer.setTimeout(myFunc, 1, 'foo', 4, {}, undefined);
  sbtimer.setInterval(myFunc, 1);
  sbtimer.setInterval(myFunc, 1, {}, null, 'bar', undefined, 87);
  loader.unload();
  setTimeout(function() {
    test.pass("timer testUnload passed");
    test.done();
  }, 2);
};
