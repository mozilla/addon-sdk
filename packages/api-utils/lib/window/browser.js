/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Class } = require('api-utils/heritage');
const { windowNS } = require('api-utils/window/namespace');
const { on, off, once } = require('api-utils/event/core');
const { method } = require('api-utils/functional');
const { openDialog } = require('api-utils/window/utils');
const unload = require('api-utils/unload');
const { getWindowTitle } = require('api-utils/window/utils');
const { getMode } = require('api-utils/private-browsing/utils');
const { EventTarget } = require('api-utils/event/target');

const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec, consider using require("tabs") instead';

const BrowserWindow = Class({
  initialize: function initialize(options) {
    EventTarget.prototype.initialize.call(this, options);
    windowNS(this).window = options.window;
  },
  activate: function activate() {
    // TODO
    return null;
  },
  close: function() {
    throw new Error(ERR_FENNEC_MSG);
    return null;
  },
  get title() getWindowTitle(windowNS(this).window),
  // TODO: remove assumption below
  // NOTE: Fennec only has one window, which is assumed below
  get tabs() require('tabs'),
  get activeTab() require('tabs').activeTab,
  on: method(on),
  removeListener: method(off),
  once: method(once),
  get isPrivateBrowsing() getMode(windowNS(this).window),
});
exports.BrowserWindow = BrowserWindow;
