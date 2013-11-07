/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict'

const { defer: async } = require('sdk/lang/functional');
const { Test } = require('./Test.jsm');
const { console: devtoolsConsole } = require('resource://gre/modules/devtools/Console.jsm');
const { Promise } = require('modules/Promise.jsm');
const { TouchEventHandler } = require('resource://gre/modules/devtools/touch-events');

exports['test alias for loading JSM in addon'] = function (assert, done) {
  let { promise, resolve } = Promise.defer();
  async(() => resolve(5))();
  promise.then(val => {
    assert.equal(val, 5, 'aliased JSM correctly loaded in addon');
  }).then(done, done);
};

exports['test relative loading JSM in addon'] = function (assert) {
  assert.equal(Test.square(5), 25, 'relative JSM correctly loaded in addon');
};

exports['test resource:// JSM loading in addon'] = function (assert) {
  assert.ok(devtoolsConsole.log, 'resource:// JSM correctly loaded in addon');
};

exports['test resource:// JS loading in addon'] = function (assert) {
  assert.ok(TouchEventHandler,
    'resource:// JS correctly loaded in addon without .js suffix');
};

require('sdk/test/runner').runTestsFromModule(module);
