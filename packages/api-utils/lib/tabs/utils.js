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
  return tab.ownerDocument.defaultView;
}
exports.getOwnerWindow = getOwnerWindow;

if (require("api-utils/xul-app").is("Fennec")) {
  var openTab = function openTab(window, url, options) {
    options = options || {};
    return window.BrowserApp.addTab(url, {
      selected: options.inBackground ? false : true,
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
  return getOwnerWindow(tab).gBrowser.removeTab(tab);
}
exports.closeTab = closeTab;

function activateTab(tab) {
  getOwnerWindow(tab).gBrowser.selectedTab = tab;
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
