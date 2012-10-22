/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { browserWindows } = require('windows');
const { pb, pbUtils } = require('private-browsing-helper');

const wm = Cc['@mozilla.org/appshell/window-mediator;1'].
           getService(Ci.nsIWindowMediator);

if (pbUtils.isWindowPBEnabled(wm.getMostRecentWindow('navigator:browser'))) {
  exports.testPerWindowPrivateBrowsing_getter = function(test) {
    let activeWindow =  wm.
                        getMostRecentWindow('navigator:browser');

    // is per-window PB implemented?
    let currentState = activeWindow.gPrivateBrowsingUI.privateWindow;
  
    pbUtils.setMode(false, activeWindow);
  
    test.assertEqual(activeWindow.gPrivateBrowsingUI.privateWindow,
                     browserWindows.activeWindow.isPrivateBrowsing,
                     'Active window is not in PB mode');
  
    pbUtils.setMode(true, activeWindow);
  
    test.assertEqual(activeWindow.gPrivateBrowsingUI.privateWindow,
                     browserWindows.activeWindow.isPrivateBrowsing,
                     'Active window is in PB mode');
  
    pbUtils.setMode(currentState, activeWindow);
  };
}
