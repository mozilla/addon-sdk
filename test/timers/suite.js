/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 'use strict';

exports.getTimerTests = function(timer) {
  let tests = {};

  tests.testSetTimeout = function(test) {
    test.waitUntilDone();

    timer.setTimeout(function() {
      test.pass("testSetTimeout passed");
      test.done();
    }, 1);
  };

  tests.testParamedSetTimeout = function(test) {
    test.waitUntilDone();

    let params = [1, 'foo', { bar: 'test' }, null, undefined];
    timer.setTimeout.apply(null, [function() {
      test.assertEqual(arguments.length, params.length);
      for (let i = 0, ii = params.length; i < ii; i++)
        test.assertEqual(params[i], arguments[i]);
      test.done();
    }, 1].concat(params));
  };

  tests.testClearTimeout = function(test) {
    test.waitUntilDone();

    var myFunc = function myFunc() {
      test.fail("myFunc() should not be called in testClearTimeout");
    };
    var id = timer.setTimeout(myFunc, 1);
    timer.setTimeout(function() {
      test.pass("testClearTimeout passed");
      test.done();
    }, 2);
    timer.clearTimeout(id);
  };

  tests.testParamedClearTimeout = function(test) {
    test.waitUntilDone();

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
  };

  tests.testSetInterval = function (test) {
    test.waitUntilDone();

    var count = 0;
    var id = timer.setInterval(function () {
      count++;
      if (count >= 5) {
        timer.clearInterval(id);
        test.pass("testSetInterval passed");
        test.done();
      }
    }, 1);
  };

  tests.testParamedSetInerval = function(test) {
    test.waitUntilDone();

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
  };

  tests.testClearInterval = function (test) {
    test.waitUntilDone();

    timer.clearInterval(timer.setInterval(function () {
      test.fail("setInterval callback should not be called");
    }, 1));
    var id = timer.setInterval(function () {
      timer.clearInterval(id);
      test.pass("testClearInterval passed");
      test.done();
    }, 2);
  };

  tests.testParamedClearInterval = function(test) {
    test.waitUntilDone();

    timer.clearInterval(timer.setInterval(function () {
      test.fail("setInterval callback should not be called");
    }, 1, timer, {}, null));

    let id = timer.setInterval(function() {
      timer.clearInterval(id);
      test.assertEqual(3, arguments.length);
      test.done();
    }, 2, undefined, 'test', {});
  };

  return tests;
}

