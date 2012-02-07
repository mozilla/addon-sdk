/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { uriPrefix, name } = require('@packaging');
const { WindowTracker } = require('api-utils/window-utils');
const { add, remove } = require('api-utils/array');
const { getTabs, closeTab } = require('api-utils/tabs/utils');
const { when: unload } = require('api-utils/unload');

const addonURL = uriPrefix + name + '/data/index.html';

WindowTracker({
  onTrack: function onTrack(window) {
    add(window.XULBrowserWindow.inContentWhitelist, addonURL);
  },
  onUntrack: function onUntrack(window) {
    getTabs(window).filter(function(tab) {
      tab.linkedBrowser.currentURI.spec === addonURL
    }).forEach(closeTab);
  }
});
