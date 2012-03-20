/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { uriPrefix, name } = require('@packaging');
const { WindowTracker, isBrowser } = require('api-utils/window-utils');
const { add, remove } = require('api-utils/array');
const { getTabs, closeTab } = require('api-utils/tabs/utils');

// Note: This is an URL that will be returned by calling
// `require('self').data.url('index.html')` from the add-on modules.
// We could not use this expression as in this module it would have
// returned "addon-kit/data/index.html" instead.
const addonURL = uriPrefix + name + '/data/index.html';

WindowTracker({
  onTrack: function onTrack(window) {
    if (isBrowser(window))
      add(window.XULBrowserWindow.inContentWhitelist, addonURL);
  },
  onUntrack: function onUntrack(window) {
    getTabs(window).
      filter(function(tab) tab.linkedBrowser.currentURI.spec === addonURL).
      forEach(function(tab) {
        // Note: `onUntrack` will be called for all windows on add-on unloads,
        // so we want to clean them up from these URLs.
        remove(window.XULBrowserWindow.inContentWhitelist, addonURL);
        closeTab(tab);
      });
  }
});
