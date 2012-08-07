/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Class } = require('api-utils/heritage');
const { Tab } = require('api-utils/tabs/tab-fennec');
const { browserWindows } = require("api-utils/windows/fennec");
const { windowNS } = require('api-utils/window/namespace');
const { tabsNS, tabNS } = require('api-utils/tabs/namespace');
const { openTab } = require('api-utils/tabs/utils');
const { on, once, off, emit } = require('api-utils/event/core');
const { method } = require('../functional');

var mainWindow = windowNS(browserWindows.activeWindow).window;

const Tabs = Class({
  initialize: function initialize(options) {
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

    window.BrowserApp.deck.addEventListener("TabOpen", function(evt) {
      let browser = evt.target;

      let tab = getTabForBrowser();
      if (tab === null) {
        // create a Tab instance for this new tab
        tab = addTab(Tab({
          window: window,
          tab: getRawTabForBrowser(evt.target)
        }));
      }

      // TODO: this isn't always the case..
      tabsNS(this).activeTab = tab;

      // TODO: remove listener on unload
      browser.addEventListener("DOMContentLoaded", function onReady() {
        emit(tab, "ready", tab);
        emit(this, "ready", tab);
      }.bind(this), false);

      emit(tab, "open", tab);
      emit(this, "open", tab);

      
    }.bind(this), false);

    window.BrowserApp.deck.addEventListener("TabSelect", function(evt) {
      // Set value whenever new tab becomes active.
      let tab = tabsNS(this).activeTab = getTabForBrowser(evt.target);

      emit(tab, "activate", tab);
      emit(this, "activate", tab);
    }.bind(this), false);

    window.BrowserApp.deck.addEventListener("TabClose", function(evt) {
      let tab = getTabForBrowser(evt.target);
      removeTab(tab);

      emit(tab, "close", tab)
      emit(this, "close", tab);
    }.bind(this), false);

    return this;
  },
  get activeTab() {
    return tabsNS(this).activeTab;
  },
  open: function(options) {
    let activeWin = browserWindows.activeWindow;
    let tab = getTabForRawTab(openTab(windowNS(activeWin).window, options.url));
    if (options.onOpen) {
      options.onOpen(tab);
    }
  },
  get length() tabsNS(this).tabs.length,
  __iterator__: function __iterator__() {
    let tabs = tabsNS(this).tabs;
    for each(let tab in tabs)
      yield tab;
  },
  on: method(on),
  once: method(once),
  removeListener: method(off),
});
const gTabs = exports.tabs = Tabs({window: mainWindow});

function addTab(aTab) {
  let tabs = tabsNS(gTabs).tabs;
  for (let i = tabs.length - 1; i >= 0; i--) {
    let tab = tabs[i];
    // tab is already in our list
    if (tab === aTab)
      return tab;
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
