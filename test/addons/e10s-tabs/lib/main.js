/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { merge } = require('sdk/util/object');
const { version } = require('sdk/system');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { promise: windowPromise, close, focus } = require('sdk/window/helpers');

// run e10s tests only on builds from trunk, fx-team, Nightly..
if (!version.endsWith('a1')) {
  module.exports = {};
}

function openE10sWindow() {
  let window = getMostRecentBrowserWindow().OpenBrowserWindow({ remote: true });
  return windowPromise(window, 'load').then(focus);
}

function makeE10sTests(exports) {
  let newExports = {};

  for (let key of Object.keys(exports)) {
    if (typeof(exports[key]) == "function" && key.substring(0, 4) == "test") {
      let testFunction = exports[key];
      newExports[key] = function(assert, done) {
        openE10sWindow().then(window => {
          testFunction(assert, () => {
            close(window).then(done);
          });
        });
      }
    }
  }

  return newExports;
}

merge(module.exports, makeE10sTests(require('./test-tab')));
merge(module.exports, makeE10sTests(require('./test-tab-events')));
merge(module.exports, makeE10sTests(require('./test-tab-observer')));
merge(module.exports, makeE10sTests(require('./test-tab-utils')));

require('sdk/test/runner').runTestsFromModule(module);
