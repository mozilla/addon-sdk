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
const { on, emit } = require('api-utils/event/core');

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
      //console.log("TabOpen!!!"+window.BrowserApp.tabs.length);
      let tab = getTabForBrowser(evt.target);
      if (tab === null) {
        // create a Tab instance for this new tab
        tab = addTab(Tab({
          window: window,
          tab: getRawTabForBrowser(evt.target)
        }));
      }
      tabsNS(this).activeTab = tab;
      emit(this, "open", tab);
    }.bind(this), false);

    window.BrowserApp.deck.addEventListener("TabSelect", function(evt) {
      // Set value whenever new tab becomes active.
      let tab = tabsNS(this).activeTab = getTabForBrowser(evt.target);

      emit(this, "activate", tab);
    }.bind(this), false);

    window.BrowserApp.deck.addEventListener("TabClose", function(evt) {
      let tab = getTabForBrowser(evt.target);
      emit(this, "close", tab);
    }.bind(this), false);

    return this;
  },
  get activeTab() {
	  /*
    console.log("Tab1!!!!!:" + tabsNS(this).window.BrowserApp.selectedTab.browser.currentURI.spec);
    console.log("Tab2!!!!!:" + tabsNS(this).window.BrowserApp.tabs.length);
    let tabs = tabsNS(this).window.BrowserApp.tabs;
    for (let i = 0; i< tabs.length; i++) {
      console.log("Tab3!!!!!:" + tabs[i].browser.currentURI.spec);
    }*/
    return tabsNS(this).activeTab;
  },
  open: function() {
    let activeWin = browserWindows.activeWindow;
    let tab = openTab(windowNS(activeWin).window, options.url);
    
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
      return tab;
  }

  // add the new tab
  tabsNS(gTabs).tabs.push(aTab);
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
