/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

exports.testProgramExports = function (program, assert) {
  // Test 'main' entries
  // no relative custom main `lib/index.js`
  assert.equal(program.customMainModule, 'custom entry file',
    'a node_module dependency correctly uses its `main` entry in manifest');
  // relative custom main `./lib/index.js`
  assert.equal(program.customMainModuleRelative, 'custom entry file relative',
    'a node_module dependency correctly uses its `main` entry in manifest with relative ./');
  // implicit './index.js'
  assert.equal(program.defaultMain, 'default main',
    'a node_module dependency correctly defautls to index.js for main');

  // Test directory exports
  assert.equal(program.directoryDefaults, 'utils',
    '`require`ing a directory defaults to dir/index.js');
  assert.equal(program.directoryMain, 'main from new module',
    '`require`ing a directory correctly loads the `main` entry and not index.js');
  assert.equal(program.resolvesJSoverDir, 'dir/a',
    '`require`ing "a" resolves "a.js" over "a/index.js"');

  // Test dependency's dependencies
  assert.ok(program.math.add,
    'correctly defaults to index.js of a module');
  assert.equal(program.math.add(10, 5), 15,
    'node dependencies correctly include their own dependencies');
  assert.equal(program.math.subtract(10, 5), 5,
    'node dependencies correctly include their own dependencies');
  assert.equal(program.mathInRelative.subtract(10, 5), 5,
    'relative modules can also include node dependencies');

  // Test SDK natives
  assert.ok(program.promise.defer, 'main entry can include SDK modules with no deps');
  assert.ok(program.promise.resolve, 'main entry can include SDK modules with no deps');
  assert.ok(program.eventCore.on, 'main entry can include SDK modules that have dependencies');
  assert.ok(program.eventCore.off, 'main entry can include SDK modules that have dependencies');

  // Test JSMs
  assert.ok(program.promisejsm.defer, 'can require JSM files in path');
  assert.equal(program.localJSM.test, 'this is a jsm',
    'can require relative JSM files');

  // Other tests
  assert.equal(program.areModulesCached, true,
    'modules are correctly cached');
  assert.equal(program.testJSON.dependencies['test-math'], '*',
    'correctly requires JSON files');
}
