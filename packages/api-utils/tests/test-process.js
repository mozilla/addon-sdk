/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader } = require("./helpers");
const { jetpackID } = require('@packaging');

// bug 707562: '#' char in packaging was causing loader to be undefined
exports.testBug707562 = function(test) {
  test.waitUntilDone();

  let packaging = JSON.parse(JSON.stringify(require("@packaging")));
  packaging.metadata["api-utils"].author = "###";

  let loader = Loader(module, {}, packaging);
  let process = loader.require("process");

  // has spawn?
  test.assert(process.spawn, "'process' module exports 'spawn' method.");

  let promise = process.spawn("testID", "");
  test.assertFunction(promise, "spawn makes a promise.");

  promise(function(addon) {
    addon.channel("TEST:LOADED").input(function(data) {
      test.assert(data, "The loader was successfully created!");
      loader.unload();
      test.done();
    });

    addon.loadScript('data:,sendAsyncMessage("'+jetpackID+':TEST:LOADED", !!this.loader);', false);
    test.pass("spawn's promise was delivered! (which means a addon process object is available)).");
  });
};
