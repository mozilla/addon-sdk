/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 'use strict';

const { Loader } = require("sdk/test/loader");

exports.getTimerTests = function(timer) {
  let tests = {};

  tests.testSetTimeout = function(test) {
    timer.setTimeout(function() {
      test.pass("testSetTimeout passed");
      test.done();
    }, 1);
    test.waitUntilDone();
  };

  tests.testParamedSetTimeout = function(test) {
    let params = [1, 'foo', { bar: 'test' }, null, undefined];
    timer.setTimeout.apply(null, [function() {
      test.assertEqual(arguments.length, params.length);
      for (let i = 0, ii = params.length; i < ii; i++)
        test.assertEqual(params[i], arguments[i]);
      test.done();
    }, 1].concat(params));
    test.waitUntilDone();
  };

  tests.testClearTimeout = function(test) {
    var myFunc = function myFunc() {
      test.fail("myFunc() should not be called in testClearTimeout");
    };
    var id = timer.setTimeout(myFunc, 1);
    timer.setTimeout(function() {
      test.pass("testClearTimeout passed");
      test.done();
    }, 2);
    timer.clearTimeout(id);
    test.waitUntilDone();
  };

  tests.testParamedClearTimeout = function(test) {
    let params = [1, 'foo', { bar: 'test' }, null, undefined];
    var myFunc = function myFunc() {
      test.fail("myFunc() should not be called in testClearTimeout");
    };
    var id = timer.setTimeout(myFunc, 1);
    timer.setTimeout.apply(null, [function() {
      test.assertEqual(arguments.length, params.length);
      for (let i = 0, ii = params.length; i < ii; i++)
        test.assertEqual(params[i], arguments[i]);
      test.done();
    }, 1].concat(params));
    timer.clearTimeout(id);
    test.waitUntilDone();
  };

  tests.testSetInterval = function (test) {
    var count = 0;
    var id = timer.setInterval(function () {
      count++;
      if (count >= 5) {
        timer.clearInterval(id);
        test.pass("testSetInterval passed");
        test.done();
      }
    }, 1);
    test.waitUntilDone();
  };

  tests.testParamedSetInerval = function(test) {
    let params = [1, 'foo', { bar: 'test' }, null, undefined];
    let count = 0;
    let id = timer.setInterval.apply(null, [function() {
      count ++;
      if (count < 5) {
        test.assertEqual(arguments.length, params.length);
        for (let i = 0, ii = params.length; i < ii; i++)
          test.assertEqual(params[i], arguments[i]);
      } else {
        timer.clearInterval(id);
        test.done();
      }
    }, 1].concat(params));
    test.waitUntilDone();
  };

  tests.testClearInterval = function (test) {
    timer.clearInterval(timer.setInterval(function () {
      test.fail("setInterval callback should not be called");
    }, 1));
    var id = timer.setInterval(function () {
      timer.clearInterval(id);
      test.pass("testClearInterval passed");
      test.done();
    }, 2);
    test.waitUntilDone();
  };

  tests.testParamedClearInterval = function(test) {
    timer.clearInterval(timer.setInterval(function () {
      test.fail("setInterval callback should not be called");
    }, 1, timer, {}, null));

    let id = timer.setInterval(function() {
      timer.clearInterval(id);
      test.assertEqual(3, arguments.length);
      test.done();
    }, 2, undefined, 'test', {});
    test.waitUntilDone();
  };


  tests.testUnload = function(test) {
    var loader = Loader(module);
    var sbtimer = loader.require("sdk/timers");

    var myFunc = function myFunc() {
      test.fail("myFunc() should not be called in testUnload");
    };

    sbtimer.setTimeout(myFunc, 1);
    sbtimer.setTimeout(myFunc, 1, 'foo', 4, {}, undefined);
    sbtimer.setInterval(myFunc, 1);
    sbtimer.setInterval(myFunc, 1, {}, null, 'bar', undefined, 87);
    loader.unload();
    timer.setTimeout(function() {
      test.pass("timer testUnload passed");
      test.done();
    }, 2);
    test.waitUntilDone();
  };

  return tests;
}

