/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let {
  Loader, main, unload, parseStack, generateMap, resolve, nodeResolve
} = require('toolkit/loader');
let { readURI } = require('sdk/net/url');
let { all } = require('sdk/core/promise');
let testOptions = require('@test/options');

let root = module.uri.substr(0, module.uri.lastIndexOf('/'))
// The following adds Debugger constructor to the global namespace.
const { Cu } = require('chrome');
const { addDebuggerToGlobal } = Cu.import('resource://gre/modules/jsdebugger.jsm', {});
addDebuggerToGlobal(this);

const { testProgramExports } = require(root + "/addons/native-loader/shared");

const NativeAddonTest = '/addons/native-loader/native-addon-test/';

exports['test nodeResolve'] = function (assert) {
  let rootURI = root + NativeAddonTest;
  let manifest = {};
  manifest.dependencies = {};

  // Handles extensions
  resolveTest('../package.json', './dir/c.js', './package.json');
  resolveTest('../dir/b.js', './dir/c.js', './dir/b.js');

  resolveTest('./dir/b', './index.js', './dir/b.js');
  resolveTest('../index', './dir/b.js', './index.js');
  resolveTest('../', './dir/b.js', './index.js');
  resolveTest('./dir/a', './index.js', './dir/a.js', 'Precedence dir/a.js over dir/a/');
  resolveTest('../utils', './dir/a.js', './utils/index.js', 'Requiring a directory defaults to dir/index.js');
  resolveTest('../newmodule', './dir/c.js', './newmodule/lib/file.js', 'Uses package.json main in dir to load appropriate "main"');
  resolveTest('test-math', './utils/index.js', './node_modules/test-math/index.js',
    'Dependencies default to their index.js');
  resolveTest('test-custom-main', './utils/index.js', './node_modules/test-custom-main/lib/custom-entry.js',
    'Dependencies use "main" entry');
  resolveTest('test-math/lib/sqrt', './utils/index.js', './node_modules/test-math/lib/sqrt.js',
    'Dependencies\' files can be consumed via "/"');

  resolveTest('sdk/tabs/utils', './index.js', undefined,
    'correctly ignores SDK references in paths');
  resolveTest('fs', './index.js', undefined,
    'correctly ignores built in node modules in paths');

  resolveTest('test-add', './node_modules/test-math/index.js',
    './node_modules/test-math/node_modules/test-add/index.js',
    'Dependencies\' dependencies can be found');


  function resolveTest (id, requirer, expected, msg) {
    let result = nodeResolve(id, requirer, { manifest: manifest, rootURI: rootURI });
    assert.equal(result, expected, 'nodeResolve ' + id + ' from ' + requirer + ' ' +msg);
  }
}

/*
// TODO not working in current env
exports['test bundle'] = function (assert, done) {
  loadAddon('/native-addons/native-addon-test/')
};
*/

exports['test generateMap()'] = function (assert, done) {
  getJSON(NativeAddonTest + 'expectedmap.json').then(expected => {
    generateMap({
      rootURI: root + NativeAddonTest
    }, map => {
      assert.deepEqual(map, expected, 'generateMap returns expected mappings');
      assert.equal(map['./index.js']['./dir/a'], './dir/a.js',
        'sanity check on correct mappings');
      done();
    });
  }).then(null, (reason) => console.error(reason));
};

exports['test JSM loading'] = function (assert, done) {
  getJSON('/fixtures/jsm-package/package.json').then(manifest => {
    let rootURI = root + '/fixtures/jsm-package/';
    let loader = Loader({
      paths: makePaths(rootURI),
      rootURI: rootURI,
      manifest: manifest,
      isNative: true
    });

    let program = main(loader);
    assert.ok(program.localJSMCached, 'local relative JSMs are cached');
    assert.ok(program.isCachedJSAbsolute , 'absolute resource:// js are cached');
    assert.ok(program.isCachedPath, 'JSMs resolved in paths are cached');
    assert.ok(program.isCachedAbsolute, 'absolute resource:// JSMs are cached');

    assert.ok(program.localJSM, 'able to load local relative JSMs');
    all([
      program.isLoadedPath(10),
      program.isLoadedAbsolute(20),
      program.isLoadedJSAbsolute(30)
    ]).then(([path, absolute, jsabsolute]) => {
      assert.equal(path, 10, 'JSM files resolved from path work');
      assert.equal(absolute, 20, 'JSM files resolved from full resource:// work');
      assert.equal(jsabsolute, 30, 'JS files resolved from full resource:// work');
    }).then(done, console.error);

  }).then(null, console.error);
};

exports['test native Loader with mappings'] = function (assert, done) {
  all([
    getJSON(NativeAddonTest + 'expectedmap.json'),
    getJSON(NativeAddonTest + 'package.json')
  ]).then(([expectedMap, manifest]) => {

    // Override dummy module and point it to `test-math` to see if the
    // require is pulling from the mapping
    expectedMap['./index.js']['./dir/dummy'] = './dir/a.js';

    let rootURI = root + NativeAddonTest;
    let loader = Loader({
      paths: makePaths(rootURI),
      rootURI: rootURI,
      manifest: manifest,
      requireMap: expectedMap,
      isNative: true
    });

    let program = main(loader);
    assert.equal(program.dummyModule, 'dir/a',
      'The lookup uses the information given in the mapping');

    testProgramExports(program, assert);
    unload(loader);
    done();
  }).then(null, (reason) => console.error(reason));
};

exports['test native Loader without mappings'] = function (assert, done) {
  getJSON(NativeAddonTest + 'package.json').then(manifest => {
    let rootURI = root + NativeAddonTest;
    let loader = Loader({
      paths: makePaths(rootURI),
      rootURI: rootURI,
      manifest: manifest,
      isNative: true
    });

    let program = main(loader);
    testProgramExports(program, assert);
    unload(loader);
    done();
  }).then(null, (reason) => console.error(reason));
};

exports["test require#resolve with relative, dependencies"] = function(assert, done) {
  getJSON(NativeAddonTest + 'package.json').then(manifest => {
    let rootURI = root + NativeAddonTest;
    let loader = Loader({
      paths: makePaths(rootURI),
      rootURI: rootURI,
      manifest: manifest,
      isNative: true
    });

    let program = main(loader);
    let fixtureRoot = program.require.resolve("./").replace(/native-addon-test\/(.*)/, "") + "native-addon-test/";

    assert.equal(root + NativeAddonTest, fixtureRoot, "correct resolution root");
    assert.equal(program.require.resolve("test-math"), fixtureRoot + "node_modules/test-math/index.js", "works with node_modules");
    assert.equal(program.require.resolve("./newmodule"), fixtureRoot + "newmodule/lib/file.js", "works with directory mains");
    assert.equal(program.require.resolve("./dir/a"), fixtureRoot + "dir/a.js", "works with normal relative module lookups");
    assert.equal(program.require.resolve("modules/Promise.jsm"), "resource://gre/modules/Promise.jsm", "works with path lookups");

    // TODO bug 1050422, handle loading non JS/JSM file paths
    // assert.equal(program.require.resolve("test-assets/styles.css"), fixtureRoot + "node_modules/test-assets/styles.css",
    // "works with different file extension lookups in dependencies");

    unload(loader);
    done();
  }).then(null, (reason) => console.error(reason));
};

function getJSON (uri) {
  return readURI(root + uri).then(manifest => JSON.parse(manifest));
}

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

function loadAddon (uri, map) {
  let rootURI = root + uri;
  getJSON(uri + '/package.json').then(manifest => {
    let loader = Loader({
      paths: makePaths(rootURI),
      rootURI: rootURI,
      manifest: manifest,
      isNative: true,
      modules: {
        '@test/options': testOptions
      }
    });
    let program = main(loader);
  }).then(null, console.error);
}

require('test').run(exports);
