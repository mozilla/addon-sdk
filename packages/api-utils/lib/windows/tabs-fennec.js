/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Class } = require('api-utils/heritage');
const { Tab } = require('api-utils/tabs/tab');
const { browserWindows } = require('api-utils/windows/fennec');
const { windowNS } = require('api-utils/window/namespace');
const { tabsNS, tabNS } = require('api-utils/tabs/namespace');
const { openTab, getTabs, getTabForRawTab } = require('api-utils/tabs/utils');
const { Options } = require('api-utils/tabs/common');
const { on, once, off, emit } = require('api-utils/event/core');
const { method } = require('../functional');
const { EVENTS } = require("api-utils/tabs/events");
const { EventTarget } = require('api-utils/event/target');
const { when: unload } = require('unload');
const { windowIterator } = require('api-utils/window-utils');

const mainWindow = windowNS(browserWindows.activeWindow).window;

const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec';

const Tabs = Class({
  extends: EventTarget,
  initialize: function initialize(options) {
    EventTarget.prototype.initialize.call(this, options);

    let tabsInternals = tabsNS(this);
    let window = tabsNS(this).window = options.window || mainWindow;
    let tabs = tabsNS(this).tabs = getTabs(window).map(Tab);

    // TabOpen event
    window.BrowserApp.deck.addEventListener(EVENTS.open.dom, onTabOpen, false);

    // TabSelect
    window.BrowserApp.deck.addEventListener(EVENTS.activate.dom, onTabSelect, false);

    // TabClose
    window.BrowserApp.deck.addEventListener(EVENTS.close.dom, onTabClose, false);

    // 
    window.addEventListener('close', tabsUnloader, false);
  },
  get activeTab() {
    return getTabForRawTab(tabsNS(this).window.BrowserApp.selectedTab);
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
const gTabs = exports.tabs = Tabs(mainWindow);

function tabsUnloader(evt, window) {
  window = window || evt.target;
  window.BrowserApp.deck.removeEventListener(EVENTS.open.dom, onTabOpen, false);
  window.BrowserApp.deck.removeEventListener(EVENTS.activate.dom, onTabSelect, false);
  window.BrowserApp.deck.removeEventListener(EVENTS.close.dom, onTabClose, false);
  window.BrowserApp.deck.removeEventListener('close', tabsUnloader, false);
}

// unload handler
unload(function() {
  for (let window in windowIterator()) {
    tabsUnloader({}, window);
  }
});

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

// TabOpen
function onTabOpen(evt) {
  let browser = evt.target;

  let tab = getTabForBrowser(browser);
  if (tab === null) {
    let rawTab = getRawTabForBrowser(browser);

    // create a Tab instance for this new tab
    tab = addTab(Tab(rawTab));
  }

  tabNS(tab).opened = true;

  // TabReady
  // TODO: remove listener on unload
  browser.addEventListener(EVENTS.ready.dom, function onReady() {
    emit(tab, 'ready', tab);
    emit(gTabs, 'ready', tab);
  }, false);

  emit(tab, "open", tab);
  emit(gTabs, "open", tab);
};

// TabSelect
function onTabSelect(evt) {
  // Set value whenever new tab becomes active.
  let tab = getTabForBrowser(evt.target);
  emit(tab, "activate", tab);
  emit(gTabs, "activate", tab);

  for each (let t in gTabs) {
    if (t === tab) continue;
    emit(t, 'deactivate', t);
    emit(gTabs, 'deactivate', t);
  }
};

// TabClose
function onTabClose(evt) {
  let tab = getTabForBrowser(evt.target);
  removeTab(tab);

  emit(gTabs, "close", tab);
  emit(tab, "close", tab);
};
