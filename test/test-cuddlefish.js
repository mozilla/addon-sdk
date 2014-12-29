/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const packaging = require('@loader/options');
const app = require('sdk/system/xul-app');
const get = require;

exports['test loader'] = function(assert) {
  let { Loader, Require, unload, override } = get('sdk/loader/cuddlefish');
  var prints = [];
  function print(message) {
    prints.push(message);
  }

  let loader = Loader(override(packaging, {
    globals: {
      print: print,
      foo: 1
    }
  }));
  let require = Require(loader, module);

  var fixture = require('./loader/fixture');

  assert.equal(fixture.foo, 1, 'custom globals must work.');
  assert.equal(fixture.bar, 2, 'exports are set');

  assert.equal(prints[0], 'testing', 'global print must be injected.');

  var unloadsCalled = '';

  require("sdk/system/unload").when(function(reason) {
    assert.equal(reason, 'test', 'unload reason is passed');
    unloadsCalled += 'a';
  });
  require('sdk/system/unload.js').when(function() {
    unloadsCalled += 'b';
  });

  unload(loader, 'test');

  assert.equal(unloadsCalled, 'ba',
               'loader.unload() must call listeners in LIFO order.');
};

if (packaging.isNative) {
  module.exports = {
    "test skip on jpm": (assert) => assert.pass("skipping this file with jpm")
  };
}

require('sdk/test').run(exports);
