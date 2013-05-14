/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 'use strict';

const timer = require("sdk/timers");
const { getTimerTests } = require('./timers/suite');
const { Loader } = require('sdk/test/loader');

module.exports = getTimerTests(timer);

exports.testUnload = function(test) {
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