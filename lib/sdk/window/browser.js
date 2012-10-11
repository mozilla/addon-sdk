/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Class } = require('../core/heritage');
const { windowNS } = require('./namespace');
const { on, off, once } = require('../event/core');
const { method } = require('../lang/functional');
const { getWindowTitle } = require('./utils');
const unload = require('../system/unload');
const { getMode } = require('../private-browsing/utils');
const { EventTarget } = require('../event/target');

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
  // NOTE: Fennec only has one window, which is assumed below
  // TODO: remove assumption below
  // NOTE: tabs requires windows
  get tabs() require('../tabs'),
  get activeTab() require('../tabs').activeTab,
  on: method(on),
  removeListener: method(off),
  once: method(once),
  get isPrivateBrowsing() getMode(windowNS(this).window),
});
exports.BrowserWindow = BrowserWindow;
