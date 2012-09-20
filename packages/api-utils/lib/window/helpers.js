/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { windows } = require('./utils');

// fennec
function getWindowHoldingTab(rawTab) {
  for each (let window in windows()) {
    for each (let tab in window.BrowserApp.tabs) {
      if (tab === rawTab)
        return window;
    }
  }
  return null;
}
exports.getWindowHoldingTab = getWindowHoldingTab;
