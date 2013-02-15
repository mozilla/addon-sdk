/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { getTabForContentWindow } = require('./utils');
const { Tab } = require('./tab');
const { tabNS } = require('./namespace');

function getTabForWindow(win) {
  let tab = getTabForContentWindow(win);
  // We were unable to find the related tab!
  if (!tab)
    return null;

  return getTabForRawTab(tab) || Tab({ tab: tab });
}
exports.getTabForWindow = getTabForWindow;

// only works on fennec atm
function getTabForRawTab(rawTab) {
  let tab = tabNS(rawTab).tab;
  if (tab && tabNS(tab).tab === rawTab) {
    return tab;
  }
  return null;
}
