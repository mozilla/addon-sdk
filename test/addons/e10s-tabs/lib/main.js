/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { merge } = require('sdk/util/object');
const { version } = require('sdk/system');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { promise: windowPromise, close, focus } = require('sdk/window/helpers');
const { when } = require('sdk/system/unload');

function replaceWindow(remote) {
  let old = getMostRecentBrowserWindow();
  let window = old.OpenBrowserWindow({ remote });
  return windowPromise(window, 'load').then(focus).then(_ => close(old));
}

// merge(module.exports, require('./test-tab'));
merge(module.exports, require('./test-tab-events'));
merge(module.exports, require('./test-tab-observer'));
merge(module.exports, require('./test-tab-utils'));

// run e10s tests only on builds from trunk, fx-team, Nightly..
if (!version.endsWith('a1')) {
  module.exports = {};
}

replaceWindow(true).then(_ =>
  require('sdk/test/runner').runTestsFromModule(module));

when(_ => replaceWindow(false));
