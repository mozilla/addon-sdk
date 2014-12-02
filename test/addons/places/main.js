/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { safeMerge: merge } = require('sdk/util/object');
const app = require("sdk/system/xul-app");

// Once Bug 903018 is resolved, just move the application testing to
// module.metadata.engines
if (app.is('Firefox')) {
  merge(module.exports,
    require('./lib/test-places-events'),
    require('./lib/test-places-bookmarks'),
    require('./lib/test-places-favicon'),
    require('./lib/test-places-history'),
    require('./lib/test-places-host'),
    require('./lib/test-places-utils')
  );
} else {
  exports['test unsupported'] = (assert) => {
    assert.pass('This application is unsupported.');
  };
}

require('sdk/test/runner').runTestsFromModule(module);
