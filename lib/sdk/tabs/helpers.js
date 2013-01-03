/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { getTabForContentWindow } = require('./utils');
const { Tab } = require('./tab');
const { getOwnerWindow } = require('./utils');
const { BrowserWindow } = require('../windows');

function getTabForWindow(win) {
  let tab = getTabForContentWindow(win);
  // We were unable to find the related tab!
  if (!tab)
    return null;

  let topWindow = getOwnerWindow(tab);

  return Tab({
    tab: tab,
    // Bring back this line for consistency. However it's actually not needed,
    // as soon as the `windows` module is included - even if it's not used -
    // the Tab will have the proper browser window assigned. That will be
    // eventually fixed when deprecated Trackers will be removed.
    //
    // See: https://bugzilla.mozilla.org/show_bug.cgi?id=804935
    window: BrowserWindow({ window: topWindow })
  });
}
exports.getTabForWindow = getTabForWindow;
