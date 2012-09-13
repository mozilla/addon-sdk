/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { tabNS, tabsNS } = require('./namespace');
const { defer } = require("../functional");
const { Ci } = require('chrome');

function activateTab(tab, window) {
  let gBrowser = getTabBrowserForTab(tab);

  // normal case
  if (gBrowser) {
    gBrowser.selectedTab = tab;
  }
  // fennec ?
  else if (window && window.BrowserApp) {
    window.BrowserApp.selectTab(tab);
  }
  return null;
}
// Please note: That this function is called asynchronous since in E10S that
// will be the case.
exports.activateTab = defer(activateTab);

function getTabBrowser(window) {
  return window.gBrowser;
}
exports.getTabBrowser = getTabBrowser;

function getTabContainer(window) {
  return getTabBrowser(window).tabContainer;
}
exports.getTabContainer = getTabContainer;

function getTabs(window) {
  // fennec
  if (window.BrowserApp)
    return window.BrowserApp.tabs;

  // firefox - default
  return Array.slice(getTabContainer(window).children);
}
exports.getTabs = getTabs;

function getActiveTab(window) {
  return window.gBrowser.selectedTab;
}
exports.getActiveTab = getActiveTab;

function getOwnerWindow(tab) {
  if (tab.ownerDocument)
    return tab.ownerDocument.defaultView;
  return null;
}
exports.getOwnerWindow = getOwnerWindow;

function openTab(window, url, options) {
  options = options || {};
  // fennec?
  if (window.BrowserApp) {
    return window.BrowserApp.addTab(url, {
      selected: options.inBackground ? false : true,
      pinned: options.isPinned || false
    });
  }
  return window.gBrowser.addTab(url);
};
exports.openTab = openTab;

function isTabOpen(tab) {
  return !!tab.linkedBrowser;
}
exports.isTabOpen = isTabOpen;

function closeTab(tab) {
  let gBrowser = getTabBrowserForTab(tab);
  // normal case?
  if (gBrowser)
    return gBrowser.removeTab(tab);

  let window = tabNS(getTabForRawTab(tab)).window;
  // fennec?
  if (window && window.BrowserApp)
    return window.BrowserApp.closeTab(tab);
  return null;
}
exports.closeTab = closeTab;

// fennec
function getTabForRawTab(aRawTab) {
  for each (let tab in require('tabs')) {
    if (tabNS(tab).tab === aRawTab)
      return tab;
  }
  return null;
}
exports.getTabForRawTab = getTabForRawTab;

function getURI(tab) {
  return tab.linkedBrowser.currentURI.spec;
}
exports.getURI = getURI;

function getTabBrowserForTab(tab) {
  let outerWin = getOwnerWindow(tab);
  if (outerWin)
    return getOwnerWindow(tab).gBrowser;
  return null;
}
exports.getTabBrowserForTab = getTabBrowserForTab;

function getBrowserForTab(tab) {
  if (tab.browser) // fennec
    return tab.browser;

  return tab.linkedBrowser;
}
exports.getBrowserForTab = getBrowserForTab;

function getTabTitle(tab) {
  return getBrowserForTab(tab).contentDocument.title || tab.label || "";
}
exports.getTabTitle = getTabTitle;

function getTabForWindow(win) {
  let tab = getTabForContentWindow(win);
  // We were unable to find the related tab!
  if (!tab)
    return null;

  let topWindow = getOwnerWindow(tab);
  return require('api-utils/tabs/tab').Tab({
    // TODO: api-utils should not depend on addon-kit!
    window: require("addon-kit/windows").BrowserWindow({ window: topWindow }),
    tab: tab
  });
}
exports.getTabForWindow = getTabForWindow;

function getTabContentWindow(tab) {
  return getBrowserForTab(tab).contentWindow;
}
exports.getTabContentWindow = getTabContentWindow;

function getTabForContentWindow(window) {
  // Retrieve the topmost frame container. It can be either <xul:browser>,
  // <xul:iframe/> or <html:iframe/>. But in our case, it should be xul:browser.
  let browser = window.QueryInterface(Ci.nsIInterfaceRequestor)
                   .getInterface(Ci.nsIWebNavigation)
                   .QueryInterface(Ci.nsIDocShell)
                   .chromeEventHandler;
  // Is null for toplevel documents
  if (!browser)
    return false;
  // Retrieve the owner window, should be browser.xul one
  let chromeWindow = browser.ownerDocument.defaultView;

  // Ensure that it is top-level browser window.
  // We need extra checks because of Mac hidden window that has a broken
  // `gBrowser` global attribute.
  if ('gBrowser' in chromeWindow && chromeWindow.gBrowser &&
      'browsers' in chromeWindow.gBrowser) {
    // Looks like we are on Firefox Desktop
    // Then search for the position in tabbrowser in order to get the tab object
    let browsers = chromeWindow.gBrowser.browsers;
    let i = browsers.indexOf(browser);
    if (i !== -1)
      return chromeWindow.gBrowser.tabs[i];
    return null;
  }
  else if ('BrowserApp' in chromeWindow) {
    // Looks like we are on Firefox Mobile
    return chromeWindow.BrowserApp.getTabForWindow(window)
  }

  return null;
}
exports.getTabForContentWindow = getTabForContentWindow;
