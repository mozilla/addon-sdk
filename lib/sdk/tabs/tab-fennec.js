/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { Class } = require('../core/heritage');
const { tabNS } = require('./namespace');
const { EventTarget } = require('../event/target');
const { activateTab, getTabTitle, setTabTitle, closeTab, getTabURL, getContentWindowForTab,
        setTabURL, getOwnerWindow, getTabContentType, getTabId } = require('./utils');
const { emit } = require('../event/core');
const { getOwnerWindow: getPBOwnerWindow } = require('../private-browsing/window/utils');
const { when: unload } = require('../system/unload');

const { EVENTS } = require('./events');
const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec';

const Tab = Class({
  extends: EventTarget,
  initialize: function initialize(options) {
    options = options.tab ? options : { tab: options };

    EventTarget.prototype.initialize.call(this, options);
    let tabInternals = tabNS(this);

    tabInternals.window = options.window || getOwnerWindow(options.tab);
    tabInternals.tab = options.tab;
  },

  /**
   * The title of the page currently loaded in the tab.
   * Changing this property changes an actual title.
   * @type {String}
   */
  get title() getTabTitle(tabNS(this).tab),
  set title(title) setTabTitle(tabNS(this).tab, title),

  /**
   * Location of the page currently loaded in this tab.
   * Changing this property will loads page under under the specified location.
   * @type {String}
   */
  get url() getTabURL(tabNS(this).tab),
  set url(url) setTabURL(tabNS(this).tab, url),

  /**
   * URI of the favicon for the page currently loaded in this tab.
   * @type {String}
   */
  get favicon() {
    // TODO: provide the real favicon when it is available
    console.error(ERR_FENNEC_MSG);

    // return 16x16 blank default
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEklEQVQ4jWNgGAWjYBSMAggAAAQQAAF/TXiOAAAAAElFTkSuQmCC';
  },

  getThumbnail: function() {
    // TODO: implement!
    console.error(ERR_FENNEC_MSG);

    // return 80x45 blank default
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAtCAYAAAA5reyyAAAAJElEQVRoge3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAADXBjhtAAGQ0AF/AAAAAElFTkSuQmCC';
  },

  get id() {
    return getTabId(tabNS(this).tab);
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
   * Returns the MIME type that the document loaded in the tab is being
   * rendered as.
   * @type {String}
   */
  get contentType() getTabContentType(tabNS(this).tab),

  /**
   * Create a worker for this tab, first argument is options given to Worker.
   * @type {Worker}
   */
  attach: function attach(options) {
    // BUG 792946 https://bugzilla.mozilla.org/show_bug.cgi?id=792946
    // TODO: fix this circular dependency
    let { Worker } = require('./worker');
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

getPBOwnerWindow.define(Tab, function(tab) {
  return getContentWindowForTab(tabNS(tab).tab);
});
