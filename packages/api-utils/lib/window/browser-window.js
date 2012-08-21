/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Class } = require('api-utils/heritage');
const { windowNS } = require('api-utils/window/namespace');
const { on, off, once } = require('api-utils/event/core');
const { method } = require('api-utils/functional');
const { openDialog } = require('api-utils/window/utils');
const unload = require('api-utils/unload');
const { getWindowTitle } = require('api-utils/window/utils');
const { getMode } = require('api-utils/private-browsing/utils');

const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec, consider using require("tabs") instead';

const BrowserWindow = Class({
  initialize: function initialize(options) {
      // make sure we don't have unhandled errors
      this.on('error', console.exception.bind(console));

      if ('onOpen' in options)
        this.on('open', options.onOpen);
      if ('onClose' in options)
        this.on('close', options.onClose);
      if ('onActivate' in options)
        this.on('activate', options.onActivate);
      if ('onDeactivate' in options)
        this.on('deactivate', options.onDeactivate);

      if ('tabs' in options) {
        var tabOptions = Array.isArray(options.tabs) ?
                                    options.tabs.map(Options) :
                                    [ Options(options.tabs) ];
      }
      else if ('url' in options) {
        var tabOptions = [ Options(options.url) ];
      }

      if ('window' in options) {
        windowNS(this).window = options.window;
      }
      else {
        // TODO: test
        windowNS(this).window = openDialog({
          args: tabOptions.map(function(options) {
            return options.url
          }).join("|")
        });
      }

    return this;
  },
  destroy: function() {
    return null;
  },
  activate: function activate() {
    this.activeTab.activate();
    return null;
  },
  close: function() {
    throw new Error(ERR_FENNEC_MSG);
    return null;
  },
  get title() getWindowTitle(windowNS(this).window),
  get tabs() require('tabs'),
  get activeTab() require('tabs').activeTab,
  on: method(on),
  removeListener: method(off),
  once: method(once),
  get isPrivateBrowsing() getMode(windowNS(this).window),
});
exports.BrowserWindow = BrowserWindow;
