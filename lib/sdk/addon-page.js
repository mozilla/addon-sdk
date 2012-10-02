/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

module.metadata = {
  "stability": "experimental"
};

const { WindowTracker } = require('api-utils/window-utils');
const { isBrowser } = require('api-utils/window/utils');
const { add, remove } = require('api-utils/array');
const { getTabs, closeTab, getURI } = require('api-utils/tabs/utils');
const { data } = require('self');

const addonURL = data.url('index.html');

WindowTracker({
  onTrack: function onTrack(window) {
    if (isBrowser(window))
      add(window.XULBrowserWindow.inContentWhitelist, addonURL);
  },
  onUntrack: function onUntrack(window) {
    if (isBrowser(window))
      getTabs(window).
        filter(function(tab) { return getURI(tab) === addonURL; }).
        forEach(function(tab) {
          // Note: `onUntrack` will be called for all windows on add-on unloads,
          // so we want to clean them up from these URLs.
          remove(window.XULBrowserWindow.inContentWhitelist, addonURL);
          closeTab(tab);
        });
  }
});
