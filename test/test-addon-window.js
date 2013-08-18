/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

let { Loader } = require('sdk/test/loader');

exports.testReady = function(assert, done) {
  let loader = Loader(module);
  let { ready, window } = loader.require('sdk/addon/window');
  let windowIsReady = false;

  ready.then(function() {
    assert.equal(windowIsReady, false, 'ready promise was resolved only once');
    windowIsReady = true;

    window.addEventListener('unload', function unloader() {
      window.removeEventListener('unload', unloader, false);
      assert.pass('window has unloaded');

      loader.unload();
    }, false);

    loader.require('sdk/system/unload').when(function() {
      assert.pass('unloaded');
      done();
    });

    // redirect the window to cause an unload event
    window.location = 'data:text/html;charset=utf-8,new-page';
  }).then(null, assert.fail);
}

require('sdk/test').run(exports);
