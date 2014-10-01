/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const options = require("@loader/options");
const self = require("sdk/self");
const { Cu } = require("chrome");

function createNativeLoader() {
  // Create the base module loader to load the test harness
  let loaderID = "toolkit/loader";
  let loaderURI = options.paths[""] + loaderID + ".js";
  let loaderModule = Cu.import(loaderURI, {}).Loader;

  let modules = {};

  // Manually set the loader's module cache to include itself;
  // which otherwise fails due to lack of `Components`.
  modules[loaderID] = loaderModule;

  let loader = loaderModule.Loader({
    id: self.id,
    name: self.name,
    version: self.version,
    loadReason: self.loadReason,
    paths: options.paths,
    modules: modules,
    isNative: true,
    rootURI: options.paths["./"],
    metadata: {},
  });

  console.log(uneval(options.paths));
  let module = loaderModule.Module("main", options.paths["./"] + "main.js");
  return loaderModule.Require(loader, module);
}

exports.testLoader = function*(assert) {
  let require = createNativeLoader();

  let exports = require("module1");
  assert.equal(exports.module, "module1", "Found the right module");

  exports = require("module2");
  assert.equal(exports.module, "module2", "Found the right module");

  exports = require("module3");
  assert.equal(exports.module, "module3", "Found the right module");

  exports = require("node1");
  assert.equal(exports.module, "node1", "Found the right module");

  exports = require("node2");
  assert.equal(exports.module, "node2", "Found the right module");

  exports = require("node3");
  assert.equal(exports.module, "node3", "Found the right module");
}

require('sdk/test/runner').runTestsFromModule(module);
