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

    window.BrowserApp.deck.addEventListener(EVENTS.open.dom, function(evt) {
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

      // TODO: remove listener on unload
      browser.addEventListener(EVENTS.ready.dom, function onReady() {
        emit(tab, 'ready', tab);
        emit(this, 'ready', tab);
      }.bind(this), false);

      emit(tab, "open", tab);
      emit(this, "open", tab);
    }.bind(this), false);

    window.BrowserApp.deck.addEventListener(EVENTS.activate.dom, function(evt) {
      // Set value whenever new tab becomes active.
      let tab = tabsNS(this).activeTab = getTabForBrowser(evt.target);
      emit(tab, "activate", tab);
      emit(this, "activate", tab);

      for each (let t in this) {
        if (t === tab) continue;
        emit(t, 'deactivate', t);
        emit(this, 'deactivate', t);
      }
    }.bind(this), false);

    window.BrowserApp.deck.addEventListener(EVENTS.close.dom, function(evt) {
      let tab = getTabForBrowser(evt.target);
      removeTab(tab);

      emit(this, "close", tab);
      emit(tab, "close", tab)
    }.bind(this), false);

    return this;
  },
  get activeTab() {
    return tabsNS(this).activeTab;
  },
  open: function(options) {
    options = Options(options);
    let activeWin = browserWindows.activeWindow;
    let rawTab = openTab(windowNS(activeWin).window, options.url, {
      inBackground: options.inBackground,
      isPinned: options.isPinned
    });
    let tab = getTabForRawTab(rawTab);

    if (options.onClose)
      tab.once('close', options.onClose);

    if (options.onOpen) {
      if (tabNS(tab).opened)
        options.onOpen(tab);
      else
        tab.once('open', options.onOpen);
    }

    if (options.onReady)
      tab.on('ready', options.onReady);

    if (options.onActivate)
      tab.once('activate', options.onActivate);

    return tab;
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
