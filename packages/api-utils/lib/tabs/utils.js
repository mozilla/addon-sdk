/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { validateOptions } = require("api-utils/api-utils");

function getTabContainer(tabBrowser) {
  return tabBrowser.tabContainer;
}
exports.getTabContainer = getTabContainer;

function getTabBrowsers(window) {
  return Array.slice(window.document.getElementsByTagName("tabbrowser"));
}
exports.getTabBrowsers = getTabBrowsers;

function getTabContainers(window) {
  return getTabBrowsers(window).map(getTabContainer);
}
exports.getTabContainers = getTabContainers;

function getTabs(window) {
  return getTabContainers(window).reduce(function (tabs, container) {
    tabs.push.apply(tabs, container.children);
    return tabs;
  }, []);
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

if (require("api-utils/xul-app").is("Fennec")) {
  var openTab = function openTab(window, url, options) {
    options = options || {};
    return window.BrowserApp.addTab(url, {
      selected: options.inBackground ? false : true,
      pinned: options.isPinned || false
    });
  }
}
else {
  var openTab = function openTab(window, url) {
    return window.gBrowser.addTab(url);
  }
}
exports.openTab = openTab;

function isTabOpen(tab) {
  return !!tab.linkedBrowser;
}
exports.isTabOpen = isTabOpen;

function closeTab(tab) {
  return getGBrowserForTab(tab).removeTab(tab);
}
exports.closeTab = closeTab;

function activateTab(tab) {
  getGBrowserForTab(tab).selectedTab = tab;
}
exports.activateTab = activateTab;

function getURI(tab) {
  return tab.linkedBrowser.currentURI.spec;
}
exports.getURI = getURI;

function Options(options) {
  if ("string" === typeof options)
    options = { url: options };

  return validateOptions(options, {
    url: { is: ["string"] },
    inBackground: { is: ["undefined", "boolean"] },
    isPinned: { is: ["undefined", "boolean"] },
    onOpen: { is: ["undefined", "function"] },
    onClose: { is: ["undefined", "function"] },
    onReady: { is: ["undefined", "function"] },
    onActivate: { is: ["undefined", "function"] },
    onDeactivate: { is: ["undefined", "function"] }
  });
}
exports.Options = Options;

function getGBrowserForTab(tab) {
  let outerWin = getOwnerWindow(tab);
  if (outerWin)
    return getOwnerWindow(tab).gBrowser;
  return null;
}
exports.getGBrowserForTab = getGBrowserForTab;

function getBrowserForTab(tab) {
  let gBrowser = getGBrowserForTab(tab);
  if (gBrowser) // firefox
    return getGBrowserForTab(tab).getBrowserForTab(tab);
  else if (tab.browser) // fennec
    return tab.browser;

  return null;
}
exports.getBrowserForTab = getBrowserForTab;

function getTabTitle(tab) {
  return getBrowserForTab(tab).contentDocument.title || tab.label || "";
}
exports.getTabTitle = getTabTitle;
