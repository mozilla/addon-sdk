/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { tabNS, tabsNS } = require('api-utils/tabs/namespace');
const { defer } = require("../functional");
const { Ci } = require('chrome');

function activateTab(tab, window) {
  let gBrowser = getGBrowserForTab(tab);

  // normal case
  if (gBrowser) {console.log(1);
    gBrowser.selectedTab = tab;
  }
  // fennec ?
  else if (window && window.BrowserApp) {console.log(2);
    window.BrowserApp.selectTab(tab);
  }
  return null;
}
// Please note: That this function is called asynchronous since in E10S that
// will be the case.
exports.activateTab = defer(activateTab);

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
  // fennec
  if (window.BrowserApp)
    return window.BrowserApp.tabs;

  // firefox - default
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
  let gBrowser = getGBrowserForTab(tab);
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
  let tabs = tabsNS(require('tabs')).tabs;
  for (let i = tabs.length - 1; i >= 0; i--) {
    let tab = tabs[i];
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

function getTabForWindow(win) {
  // Get browser window
  let topWindow = win.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIWebNavigation)
                     .QueryInterface(Ci.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindow);
  if (!topWindow.gBrowser) return null;

  // Get top window object, in case we are in a content iframe
  let topContentWindow;
  try {
    topContentWindow = win.top;
  } catch(e) {
    // It may throw if win is not a valid content window
    return null;
  }

  function getWindowID(obj) {
    return obj.QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowUtils)
              .currentInnerWindowID;
  }

  // Search for related Tab
  let topWindowId = getWindowID(topContentWindow);
  for (let i = 0; i < topWindow.gBrowser.browsers.length; i++) {
    let w = topWindow.gBrowser.browsers[i].contentWindow;
    if (getWindowID(w) == topWindowId) {
      return require('api-utils/tabs/tab').Tab({
        // TODO: api-utils should not depend on addon-kit!
        window: require("addon-kit/windows").BrowserWindow({ window: topWindow }),
        tab: topWindow.gBrowser.tabs[i]
      });
    }
  }

  // We were unable to find the related tab!
  return null;
}
exports.getTabForWindow = getTabForWindow;
