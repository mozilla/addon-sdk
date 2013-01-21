/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { data } = require('self');

if (require('sdk/system/runtime').OS != 'WINNT') {
  exports.testSymlinks = function(assert) {
    assert.equal(data.load('index.html'), 'SYMLINK TEST DATA');
    assert.equal(data.load('extra/index.html'), 'SYMLINK TEST DATA');
    assert.equal(require('extra/extra').FOO, 'BAR');
  };
}
else {
  exports.testNothing = function() {
  	assert.ok(true, 'Windows can not do useful things like symlink.')
  }
}

require("sdk/test/runner").runTestsFromModule(module);
