/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Class } = require('api-utils/heritage');
const { Tab } = require('api-utils/tabs/tab-fennec');
const { browserWindows } = require("api-utils/windows/fennec");
const { windowNS } = require('api-utils/window/namespace');
const { tabsNS, tabNS } = require('api-utils/tabs/namespace');
const { openTab, Options } = require('api-utils/tabs/utils');
const { on, once, off, emit } = require('api-utils/event/core');
const { method } = require('../functional');
const { EVENTS } = require("api-utils/tabs/events");
const { EventTarget } = require('api-utils/event/target');
const { when: unload } = require('unload');

var mainWindow = windowNS(browserWindows.activeWindow).window;

const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec';

const Tabs = Class({
  extends: EventTarget,
  initialize: function initialize(options) {
    EventTarget.prototype.initialize.call(this, options);

    let window = tabsNS(this).window = options.window;
    let tabs = tabsNS(this).tabs = [];

    for (let i = 0, len = window.BrowserApp.tabs.length; i < len; i++) {
      let rawTab = window.BrowserApp.tabs[i];
      let tab = Tab({
        window: window,
        tab: rawTab
      });

      tabs.push(tab);

      if (window.BrowserApp.selectedTab == rawTab)
        tabsNS(this).activeTab = tab;
    }

    // TabOpen
    let onTabOpen = (function(evt) {
      let browser = evt.target;

      let tab = getTabForBrowser(browser);
      if (tab === null) {
        let rawTab = getRawTabForBrowser(evt.target);

        // create a Tab instance for this new tab
        tab = addTab(Tab({
          window: window,
          tab: rawTab
        }));

        if (window.BrowserApp.selectedTab === rawTab) {
          // TODO: this isn't always the case..
          tabsNS(this).activeTab = tab;
        }
      }

      tabNS(tab).opened = true;

      // TabReady
      // TODO: remove listener on unload
      browser.addEventListener(EVENTS.ready.dom, function onReady() {
        emit(tab, 'ready', tab);
        emit(this, 'ready', tab);
      }.bind(this), false);

      emit(tab, "open", tab);
      emit(this, "open", tab);
    }).bind(this)

    // TabSelect
    let onTabSelect = function(evt) {
      // Set value whenever new tab becomes active.
      let tab = tabsNS(this).activeTab = getTabForBrowser(evt.target);
      emit(tab, "activate", tab);
      emit(this, "activate", tab);

      for each (let t in this) {
        if (t === tab) continue;
        emit(t, 'deactivate', t);
        emit(this, 'deactivate', t);
      }
    }.bind(this);

    // TabClose
    let onTabClose = function(evt) {
      let tab = getTabForBrowser(evt.target);
      removeTab(tab);

      emit(this, "close", tab);
      emit(tab, "close", tab);
    }.bind(this);

    // TabOpen event
    window.BrowserApp.deck.addEventListener(EVENTS.open.dom, onTabOpen, false);

    // TabSelect
    window.BrowserApp.deck.addEventListener(EVENTS.activate.dom, onTabSelect, false);

    // TabClose
    window.BrowserApp.deck.addEventListener(EVENTS.close.dom, onTabClose, false);

    unload(function() {
      window.BrowserApp.deck.removeEventListener(EVENTS.open.dom, onTabOpen, false);
      window.BrowserApp.deck.removeEventListener(EVENTS.activate.dom, onTabSelect, false);
      window.BrowserApp.deck.removeEventListener(EVENTS.close.dom, onTabClose, false);
      off(this);
    }.bind(this));

    return this;
  },
  get activeTab() {
    return tabsNS(this).activeTab;
  },
  open: function(options) {
    options = Options(options);
    let activeWin = browserWindows.activeWindow;

    if (options.isPinned) {
      console.error(ERR_FENNEC_MSG); // TODO
    }

    let rawTab = openTab(windowNS(activeWin).window, options.url, {
      inBackground: options.inBackground
    });

    // by now the tab has been created
    let tab = getTabForRawTab(rawTab);

    if (options.onClose)
      tab.on('close', options.onClose);

    if (options.onOpen) {
      // NOTE: on Fennec this will be true
      if (tabNS(tab).opened)
        options.onOpen(tab);

      tab.on('open', options.onOpen);
    }

    if (options.onReady)
      tab.on('ready', options.onReady);

    if (options.onActivate)
      tab.on('activate', options.onActivate);

    return tab;
  },
  get length() tabsNS(this).tabs.length,
  __iterator__: function __iterator__() {
    let tabs = tabsNS(this).tabs;
    for each(let tab in tabs)
      yield tab;
  }
});
const gTabs = exports.tabs = Tabs({window: mainWindow});

function addTab(aTab) {
  let tabs = tabsNS(gTabs).tabs;
  for (let i = tabs.length - 1; i >= 0; i--) {
    let tab = tabs[i];
    // tab is already in our list
    if (tab === aTab)
      return aTab;
  }

  // add the new tab
  tabsNS(gTabs).tabs.push(aTab);
  return aTab;
}

function removeTab(aTab) {
  let tabs = tabsNS(gTabs).tabs;
  for (let i = tabs.length - 1; i >= 0; i--) {
    let tab = tabs[i];
    // tab is already in our list
    if (tab === aTab) {
      tabs.splice(i, 1);
      return aTab;
    }
  }
  return aTab;
}

function getTabForBrowser(browser) {
  return getTabForRawTab(getRawTabForBrowser(browser));
}

function getRawTabForBrowser(browser) {
  let tabs = mainWindow.BrowserApp.tabs;
  for (let i = 0; i < tabs.length; i++) {
    let tab = tabs[i];
    if (tab.browser === browser)
      return tab
  }
  return null;
}

function getTabForRawTab(aRawTab) {
  let tabs = tabsNS(gTabs).tabs;
  for (let i = tabs.length - 1; i >= 0; i--) {
    let tab = tabs[i];
    if (tabNS(tab).tab === aRawTab)
      return tab;
  }
  return null;
}
