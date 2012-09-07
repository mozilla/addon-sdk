/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { Class } = require('api-utils/heritage');
const { tabNS } = require('api-utils/tabs/namespace');
const { getMostRecentBrowserWindow } = require('api-utils/window/utils');
const { EventTarget } = require('api-utils/event/target');
const { activateTab, getTabTitle, closeTab } = require('api-utils/tabs/utils');
const { Worker } = require('api-utils/tabs/worker');
const { emit } = require('api-utils/event/core');
const { when: unload } = require('unload');

const { EVENTS } = require("./events");
const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec';

const Tab = Class({
  extends: EventTarget,
  initialize: function initialize(tab) {
    let options = { tab: tab };

    EventTarget.prototype.initialize.call(this, options);
    let tabInternals = tabNS(this);

    tabInternals.window = options.window || getMostRecentBrowserWindow();
    tabInternals.tab = options.tab;

    // TabReady
    tabInternals.onReady = onTabReady.bind(this);
    tab.browser.addEventListener(EVENTS.ready.dom, tabInternals.onReady, false);
  },

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
    return null;
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
    return Worker(options, tabNS(this).tab.browser.contentWindow);
  },

  /**
   * Make this tab active.
   */
  activate: function activate() {
    activateTab(tabNS(this).tab, tabNS(this).window);
  },

  /**
   * Close the tab
   */
  close: function close(callback) {
    if (callback)
      this.once(EVENTS.close.name, callback);

    closeTab(tabNS(this).tab);
  },

  /**
   * Reload the tab
   */
  reload: function reload() {
    tabNS(this).tab.browser.reload();
  }
});
exports.Tab = Tab;

unload(function() {
  for each (let tab in require('tabs')) {
    let tabInternals = tabNS(tab);
    tabInternals.tab.browser.removeEventListener(EVENTS.ready.dom, tabInternals.onReady, false);
    tabInternals.onReady = null;
    tabInternals.tab = null;
    tabInternals.window = null;
  }
});

function onTabReady() {
  emit(this, 'ready', this);
  emit(require('tabs'), 'ready', this);
}
