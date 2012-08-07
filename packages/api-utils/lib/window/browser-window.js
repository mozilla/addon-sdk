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
        windowNS(this).window = openDialog({
          args: tabOptions.map(function(options) {
            return options.url
          }).join("|")
        });
      }

    return this;
  },
  destroy: function() {
    // TODO: implement
  },
  activate: function activate() {
    let window = windowNS(this).window;
    if (window) window.focus();
    return this;
  },
  // TODO: consider using window.BrowserApp.quit() for Fennec..
  close: function() {
    let window = windowNS(this).window;
    if (window) window.close();
    return this;
  },
  get title() {
    return getWindowTitle(windowNS(this).window);
  },
  get tabs() require('api-utils/windows/tabs-fennec').tabs,
  on: method(on),
  off: method(off),
  removeListener: method(off),
  once: method(once)
});
exports.BrowserWindow = BrowserWindow;
