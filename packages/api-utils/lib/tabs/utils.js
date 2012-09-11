/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Ci } = require("chrome");

function getTabBrowser(window) {
  return window.gBrowser;
}
exports.getTabBrowser = getTabBrowser;

function getTabContainer(window) {
  return getTabBrowser(window).tabContainer;
}
exports.getTabContainer = getTabContainer;

function getTabs(window) {
  return Array.slice(getTabContainer(window).children);
}
exports.getTabs = getTabs;

function getActiveTab(window) {
  return window.gBrowser.selectedTab;
}
exports.getActiveTab = getActiveTab;

function getOwnerWindow(tab) {
  return tab.ownerDocument.defaultView;
}
exports.getOwnerWindow = getOwnerWindow;

function openTab(window, url) {
  return window.gBrowser.addTab(url);
}
exports.openTab = openTab;

function isTabOpen(tab) {
  return !!tab.linkedBrowser;
}
exports.isTabOpen = isTabOpen;

function closeTab(tab) {
  return getTabBrowserForTab(tab).removeTab(tab);
}
exports.closeTab = closeTab;

function activateTab(tab) {
  getTabBrowserForTab(tab).selectedTab = tab;
}
exports.activateTab = activateTab;

function getURI(tab) {
  return tab.linkedBrowser.currentURI.spec;
}
exports.getURI = getURI;

function getTabBrowserForTab(tab) {
  return getOwnerWindow(tab).gBrowser;
}
exports.getTabBrowserForTab = getTabBrowserForTab;

function getBrowserForTab(tab) {
  return tab.linkedBrowser;
}
exports.getBrowserForTab = getBrowserForTab;

function getTabTitle(tab) {
  return getBrowserForTab(tab).contentDocument.title || tab.label;
}
exports.getTabTitle = getTabTitle;

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
