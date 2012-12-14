/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { browserWindows } = require('sdk/windows');
const { pb, pbUtils } = require('private-browsing-helper');

const wm = Cc['@mozilla.org/appshell/window-mediator;1'].
           getService(Ci.nsIWindowMediator);

exports["test Per Window Private Browsing getter"] = function(assert) {
  let activeWindow =  wm.
                      getMostRecentWindow('navigator:browser');

  // is per-window PB implemented?
  let currentState = activeWindow.gPrivateBrowsingUI.privateWindow;

  pbUtils.setMode(false, activeWindow);

  assert.equal(activeWindow.gPrivateBrowsingUI.privateWindow,
                   browserWindows.activeWindow.isPrivateBrowsing,
                   'Active window is not in PB mode');

  pbUtils.setMode(true, activeWindow);

  assert.equal(activeWindow.gPrivateBrowsingUI.privateWindow,
                   browserWindows.activeWindow.isPrivateBrowsing,
                   'Active window is in PB mode');

  pbUtils.setMode(currentState, activeWindow);
}

if (!pbUtils.isWindowPBEnabled(wm.getMostRecentWindow('navigator:browser'))) {
  module.exports = {
    "test Unsupported Test": function UnsupportedTest (assert) {
        assert.pass(
          "Skipping this test on platform that doesn't support Window Private" +
          " browsing."
        );
    }
  }
}

require("test").run(exports);
