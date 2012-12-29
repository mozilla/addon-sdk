/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { browserWindows } = require('sdk/windows');
const { pb, pbUtils } = require('private-browsing-helper');
const { openDialog } = require('window/utils');
const array = require('sdk/util/array');

if (!pbUtils.isWindowPBEnabled()) {
  module.exports = {
    "test Unsupported Test": function UnsupportedTest (assert) {
        assert.pass(
          "Skipping this test on platform that doesn't support Window Private" +
          " browsing."
        );
    }
  }
}
else {
  exports["test Per Window Private Browsing getter"] = function(assert, done) {
    let win = openDialog({
      private: true
    });

    win.addEventListener('DOMContentLoaded', function onload() {
      win.removeEventListener('DOMContentLoaded', onload, false);

      assert.equal(pbUtils.getMode(win),
                   true, 'Newly opened window is in PB mode');
      assert.equal(pb.isActive, true, 'PB mode is active');

      win.addEventListener("unload", function onunload() {
        win.removeEventListener('unload', onload, false);
        assert.equal(pb.isActive, false, 'PB mode is not active');
        done();
      }, false);
      win.close();
    }, false);
  }
}

require("test").run(exports);
