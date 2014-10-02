/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const options = require("@loader/options");
const testOptions = require('@test/options');
const { readURI } = require('sdk/net/url');
const { Loader, Module, Require } = require('toolkit/loader');
const { testProgramExports } = require("./shared");

function makePaths (uri) {
  // Uses development SDK modules if overloaded in loader
  let sdkPaths = testOptions.paths ? testOptions.paths[''] : 'resource://gre/modules/commonjs/';
  return {
    './': uri,
    'sdk/': sdkPaths + 'sdk/',
    'toolkit/': sdkPaths + 'toolkit/',
    'modules/': 'resource://gre/modules/'
  };
}

function getJSON (uri) {
  return readURI(uri).then(manifest => JSON.parse(manifest));
}

function createNativeLoader() {
  let rootURI = options.paths["./"];
  return getJSON(rootURI + 'package.json').then(manifest => {
    let loader = Loader({
      paths: makePaths(rootURI),
      rootURI: rootURI,
      manifest: manifest,
      isNative: true,
      modules: {
        '@test/options': testOptions
      }
    });
    let module = Module("main", rootURI + "main.js");
    return Require(loader, module);
  }).then(null, console.error);
}

exports.testLoader = function*(assert) {
  let require = yield createNativeLoader();

  let program = require("./native-addon-test");
  testProgramExports(program, assert);
}

require('sdk/test/runner').runTestsFromModule(module);
