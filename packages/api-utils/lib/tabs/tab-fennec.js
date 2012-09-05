/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require('chrome');
const { Class } = require('api-utils/heritage');
const { tabNS } = require('api-utils/tabs/namespace');
const { defer } = require("../functional");
const { EVENTS } = require("./events");
const { EventTarget } = require('api-utils/event/target');
const { on, once, off } = require('api-utils/event/core');
const { method } = require('../functional');
const { getTabTitle } = require('api-utils/tabs/utils');

const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec';

const Tab = Class({
  extends: EventTarget,
  initialize: function initialize(options) {
    EventTarget.prototype.initialize.call(this, options);
    let tabInternals = tabNS(this);

    tabInternals.window = options.window;
    tabInternals.tab = options.tab;
  },
  destroy: function() {},

  /**
   * The title of the page currently loaded in the tab.
   * Changing this property changes an actual title.
   * @type {String}
   */
  get title() getTabTitle(tabNS(this).tab),
  set title(value) tabNS(this).tab.browser.contentDocument.title = String(value),

  /**
   * Location of the page currently loaded in this tab.
   * Changing this property will loads page under under the specified location.
   * @type {String}
   */
  get url() String(tabNS(this).tab.browser.currentURI.spec),
  set url(url) {
    tabNS(this).tab.browser.loadURI(url);
  },

  /**
   * URI of the favicon for the page currently loaded in this tab.
   * @type {String}
   */
  get favicon() {
    // TODO: provide the real favicon when it is available
    console.error(ERR_FENNEC_MSG);

    // return blank default
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEklEQVQ4jWNgGAWjYBSMAggAAAQQAAF/TXiOAAAAAElFTkSuQmCC';
  },

  getThumbnail: function() {
    throw new Error(ERR_FENNEC_MSG); // TODO
  },

  /**
   * The index of the tab relative to other tabs in the application window.
   * Changing this property will change order of the actual position of the tab.
   * @type {Number}
   */
  get index() {
    let tabs = tabNS(this).window.BrowserApp.tabs;
    let tab = tabNS(this).tab;
    for (var i = tabs.length; i >= 0; i--) {
      if (tabs[i] === tab)
        return i;
    }
    return -1;
  },
  set index(value) {
    console.error(ERR_FENNEC_MSG); // TODO
  },

  /**
   * Whether or not tab is pinned (Is an app-tab).
   * @type {Boolean}
   */
  get isPinned() {
    console.error(ERR_FENNEC_MSG); // TODO
    return false; // TODO
  },
  pin: function pin() {
    console.error(ERR_FENNEC_MSG); // TODO
  },
  unpin: function unpin() {
    console.error(ERR_FENNEC_MSG); // TODO
  },

  /**
   * Create a worker for this tab, first argument is options given to Worker.
   * @type {Worker}
   */
  attach: function attach(options) {
    let { Worker } = require("api-utils/content/worker");
    options.window = tabNS(this).tab.browser.contentWindow;
    let worker = Worker(options);
    worker.once("detach", function detach() {
      worker.destroy();
    });
    return worker;
  },

  /**
   * Make this tab active.
   * Please note: That this function is called asynchronous since in E10S that
   * will be the case. Besides this function is called from a constructor where
   * we would like to return instance before firing a 'TabActivated' event.
   */
  activate: defer(function activate() {
    if (tabNS(this).window) // Ignore if window is closed by the time this is invoked.
      tabNS(this).window.BrowserApp.selectTab(tabNS(this).tab);
  }),

  /**
   * Close the tab
   */
  close: function close(callback) {
    if (callback)
      this.once(EVENTS.close.name, callback);

    tabNS(this).window.BrowserApp.closeTab(tabNS(this).tab);
  },

  /**
   * Reload the tab
   */
  reload: function reload() {
    tabNS(this).tab.browser.reload();
  }
});
exports.Tab = Tab;
