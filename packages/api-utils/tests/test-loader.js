/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Loader } = require("./helpers");

exports.testLoader = function(test) {
  var prints = [];
  function print(message) {
    prints.push(message);
  }

  var loader = Loader(module, { dump: print, foo: 1 });

  var fixture = loader.require('./loader/fixture');

  test.assertEqual(fixture.foo, 1, "custom globals must work.");

  test.assertEqual(prints[0], "info: testing 1 2,3,4\n",
                   "global console must work.");

  var unloadsCalled = '';

  loader.require("unload").when(function() {
    unloadsCalled += 'a';
  });
  loader.require("unload.js").when(function() {
    unloadsCalled += 'b';
  });

  loader.unload();

  test.assertEqual(unloadsCalled, 'ba',
                   "loader.unload() must call cb's in LIFO order.");
};
