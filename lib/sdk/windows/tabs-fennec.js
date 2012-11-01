/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Class } = require('../core/heritage');
const { Tab } = require('../tabs/tab');
const { browserWindows } = require('./fennec');
const { windowNS } = require('../window/namespace');
const { tabsNS, tabNS } = require('../tabs/namespace');
const { openTab, getTabs, getSelectedTab } = require('../tabs/utils');
const { Options } = require('../tabs/common');
const { on, once, off, emit } = require('../event/core');
const { method } = require('../lang/functional');
const { EVENTS } = require('../tabs/events');
const { EventTarget } = require('../event/target');
const { when: unload } = require('../system/unload');
const { windowIterator } = require('../deprecated/window-utils');
const { List, addListItem, removeListItem } = require('../util/list');

const mainWindow = windowNS(browserWindows.activeWindow).window;

const ERR_FENNEC_MSG = 'This method is not yet supported by Fennec';

const Tabs = Class({
  implements: [ List ],
  extends: EventTarget,
  initialize: function initialize(options) {
    let tabsInternals = tabsNS(this);
    let window = tabsNS(this).window = options.window || mainWindow;

    EventTarget.prototype.initialize.call(this, options);
    List.prototype.initialize.apply(this, getTabs(window).map(Tab));

    // TabOpen event
    window.BrowserApp.deck.addEventListener(EVENTS.open.dom, onTabOpen, false);

    // TabSelect
    window.BrowserApp.deck.addEventListener(EVENTS.activate.dom, onTabSelect, false);

    // TabClose
    window.BrowserApp.deck.addEventListener(EVENTS.close.dom, onTabClose, false);
  },
  get activeTab() {
    return getTabForRawTab(getSelectedTab(tabsNS(this).window));
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
  }
});
let gTabs = exports.tabs = Tabs(mainWindow);

function tabsUnloader(event, window) {
  window = window || (event && event.target);
  if (!(window && window.BrowserApp))
    return;
  window.BrowserApp.deck.removeEventListener(EVENTS.open.dom, onTabOpen, false);
  window.BrowserApp.deck.removeEventListener(EVENTS.activate.dom, onTabSelect, false);
  window.BrowserApp.deck.removeEventListener(EVENTS.close.dom, onTabClose, false);
}

// unload handler
unload(function() {
  for (let window in windowIterator()) {
    tabsUnloader(null, window);
  }
});

function addTab(tab) {
  addListItem(gTabs, tab);
  return tab;
}

function removeTab(tab) {
  removeListItem(gTabs, tab);
  return tab;
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
function onTabOpen(event) {
  let browser = event.target;

  let tab = getTabForBrowser(browser);
  if (tab === null) {
    let rawTab = getRawTabForBrowser(browser);

    // create a Tab instance for this new tab
    tab = addTab(Tab(rawTab));
  }

  tabNS(tab).opened = true;

    // TabReady
  let onReady = tabNS(tab).onReady = onTabReady.bind(tab);
  browser.addEventListener(EVENTS.ready.dom, onReady, false);

  emit(tab, 'open', tab);
  emit(gTabs, 'open', tab);
};

function onTabReady() {
  emit(this, 'ready', this);
  emit(gTabs, 'ready', this);
}

// TabSelect
function onTabSelect(event) {
  // Set value whenever new tab becomes active.
  let tab = getTabForBrowser(event.target);
  emit(tab, 'activate', tab);
  emit(gTabs, 'activate', tab);

  for each (let t in gTabs) {
    if (t === tab) continue;
    emit(t, 'deactivate', t);
    emit(gTabs, 'deactivate', t);
  }
};

// TabClose
function onTabClose(event) {
  let tab = getTabForBrowser(event.target);
  removeTab(tab);

  emit(gTabs, 'close', tab);
  emit(tab, 'close', tab);
};

function getTabForRawTab(rawTab) {
  for each (let tab in gTabs) {
    if (tabNS(tab).tab === rawTab)
      return tab;
  }
  return null;
}

unload(function() {
  for each (let tab in gTabs) {
    let tabInternals = tabNS(tab);
    tabInternals.tab.browser.removeEventListener(EVENTS.ready.dom, tabInternals.onReady, false);
    tabInternals.onReady = null;
    tabInternals.tab = null;
    tabInternals.window = null;
  }
});
