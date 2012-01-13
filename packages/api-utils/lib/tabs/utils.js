/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

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

function openTab(window, url) {
  return window.gBrowser.addTab(url);
}
exports.openTab = openTab;

function closeTab(tab) {
  return getOwnerWindow(tab).gBrowser.removeTab(tab);
}
exports.closeTab = closeTab;

function activateTab(tab) {
  getOwnerWindow(tab).gBrowser.selectedTab = tab;
}
exports.activateTab = activateTab;
