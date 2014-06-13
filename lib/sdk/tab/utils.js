/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};


// NOTE: This file should only deal with xul/native tabs


const { Ci } = require("chrome");
const { compose, constant, is, query, field } = require("../lang/functional");
const { dispatcher } = require("../util/dispatcher");
const { browsers, getToplevelWindow,
        isFennecBrowser, isFirefoxBrowser } = require("../window/utils");
const { find } = require("../util/array");
const { mapcat, map } = require("../util/sequence");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const FENNEC_UNSUPPORTED = "Functionality is not yet supported by Fennec";

// Define predicate functions that can be used to detech weather
// we deal with fennec tabs or firefox tabs.

// Predicate to detect whether tab is XUL Tab node.
let isXULTab = compose(Boolean,
                       tab => tab &&
                              tab.nodeName === "tab" &&
                              tab.namespaceURI === XUL_NS);
exports.isXULTab = isXULTab;

// Predicate to detecet whether given tab is a fettec tab.
let isFennecTab = compose(Boolean,
                          tab => tab &&
                                 tab.constructor &&
                                 tab.constructor.name === "Tab");
exports.isFennecTab = isFennecTab;

// Function takes a browser window and returns tabs associated with it.
let getTabsFor = dispatcher("getTabsFor@tab");
getTabsFor.when(isFennecBrowser, query("BrowserApp.tabs"));
getTabsFor.when(isFirefoxBrowser, query("gBrowser.tabs"));
exports.getTabsFor = getTabsFor;

// Returns array of tabs for the `window` if provided, otherwies
// tabs across all the open browser windows.
let getTabs = (window, options) =>
    window ? getTabsFor(window)
           : mapcat(getTabsFor, browsers(options));
exports.getTabs = getTabs;


// Function takes a tab and returns window it's associated with.
let getOwnerWindow = dispatcher("getOwnerWindow@tab");
getOwnerWindow.when(isXULTab, query("ownerDocument.defaultView"));
getOwnerWindow.when(isFennecTab, tab =>
                     find(browsers({ includePrivate: true }),
                          window => getTabsFor(window).some(is(tab))));
exports.getOwnerWindow = getOwnerWindow;

// Function takes tab and returns associated `gBrowser` on desktop and
// `BrowserApp` on mobile.
let getTabBrowser = dispatcher("getTabBrowser@tab");
getTabBrowser.when(isXULTab, compose(field("gBrowser"), getOwnerWindow));
getTabBrowser.when(isFennecTab, compose(field("BrowserApp"), getOwnerWindow));


// Function takes tab and makes it active on the owner window.
let activateTab = dispatcher("activate@tab");
activateTab.when(isXULTab, tab => {
  let gBrowser = getTabBrowser(tab);
  gBrowser && (gBrowser.selectedTab = tab);
});
activateTab.when(isFennecTab, tab => {
  let BrowserApp = getTabBrowser(tab);
  BrowserApp && BrowserApp.selectTab(tab);
});
exports.activateTab = activateTab;

// Function takes `window` `url` and `options` hash and opens
// at tab in a given `window` returning back a tab object.
let openTab = dispatcher("open@tab");
openTab.when(isFennecBrowser, (window, url, options) => {
  options = options || {};
  url = url || options.url;
  let BrowserApp = window.BrowserApp;
  return BrowserApp && BrowserApp.addTab(url, {
    selected: !options.inBackground,
    pinned: options.isPinned || false,
    isPrivate: options.isPrivate || false
  });
});
openTab.when(isFirefoxBrowser, (window, url, options) => {
  options = options || {};
  url = url || options.url;
  return window.gBrowser.addTab(url, !(options && options.inBackground))
});
exports.openTab = openTab;

// Takes a tab and returns boolean indicating whether it's open or not.
let isTabOpen = dispatcher("open?@tab");
isTabOpen.when(isXULTab, compose(Boolean, field("linkedBrowser")));
isTabOpen.when(isFennecTab, compose(Boolean, getOwnerWindow));
exports.isTabOpen = isTabOpen;

let closeTab = dispatcher("close@tab");
closeTab.when(isXULTab, tab => {
  let gBrowser = getTabBrowser(tab);
  // Tab may already have been detached see Bug 699450
  gBrowser && tab.parentNode && gBrowser.removeTab(tab);
});
closeTab.when(isFennecTab, tab => {
  let BrowserApp = getTabBrowser(tab);
  // Tab may already have been detached see Bug 699450
  BrowserApp && tab.browser && BrowserApp.closeTab(tab);
});
exports.closeTab = closeTab;

// Takes `tab` and returns browser element associated with it.
let getBrowserFor = dispatcher("browserFor@tab");
getBrowserFor.when(isFennecTab, field("browser"));
getBrowserFor.when(isXULTab, field("linkedBrowser"));
exports.getBrowserFor = getBrowserFor;

// Takes `tab` and returns URI for the currently loaded documnet.
let getURI = compose(query("currentURI.spec"), getBrowserFor);
exports.getURI = getURI;
exports.getTabURL = getURI;

// Takes `tab` and return unique ID associated with it.
let getTabId = dispatcher("getId@tab");
getTabId.when(isFennecTab, field("id"));
getTabId.when(isXULTab, tab => String.split(tab.linkedPanel, "panel").pop());
exports.getTabId = getTabId;

// Utility that takes
let findTab = (window, id) =>
  find(getTabsFor(window), tab => getTabId(tab) === id)

// Returns tab from the given `window` with a given `id`. If `window`
// does not has such tab returns `null`.
let getTabByIdFor = dispatcher("getTabByIdFor@tab");
getTabByIdFor.when(isFennecBrowser,
                    window => getTabBrowser(window).getTabForId(id));
getTabByIdFor.when(isFirefoxBrowser,
                    window => find(getTabsFor(window),
                                   tab => getTabId(tab) === id));

// Takes a tab `id` and returns `tab` associated with it if it's still
// exists.
let getTabById = id => {
  for (let window of getWindows()) {
    let tab = getTabByIdFor(window, id);
    if (tab)
      return tab;
  }
  return null;
}
exports.getTabById = getTabById;

// Takes a `tab` and returns it's title.
let getTabTitle = dispatcher("getTitle@tab");
getTabTitle.when(isFennecTab, compose(query("contentDocument.title"),
                                       getBrowserFor));
getTabTitle.when(isXULTab, field("label"));
exports.getTabTitle = getTabTitle;

// Takes `tab` and changes it title to given `title`.
let setTabTitle = dispatcher("setTitle@tab");
setTabTitle.when(isXULTab,
                  (tab, title) => getTabBrowser(tab).setTitle(title));
setTabTitle.when(isFennecTab, (tab, title) => {
  let browser = getBrowserFor(tab);
  return browser && (browser.contentDocument.title = String(title));
});
exports.setTabTitle = setTabTitle;

let getTabContentWindow = compose(field("contentWindow"), getBrowserFor);
exports.getTabContentWindow = getTabContentWindow;

let getAllTabContentWindows = () => {
  return map(getTabContentWindow, getTabs());
}
exports.getAllTabContentWindows = getAllTabContentWindows;


// Retrieve the topmost frame container. It can be either <xul:browser>,
// <xul:iframe/> or <html:iframe/>. But in our case, it should be xul:browser.
let getTopBrowser = window => {
  try {
    return window.QueryInterface(Ci.nsIInterfaceRequestor).
                  getInterface(Ci.nsIWebNavigation).
                  QueryInterface(Ci.nsIDocShell).
                  chromeEventHandler;
  }
  // Bug 699450: The tab may already have been detached so that `window` is
  // in a almost destroyed state and can't be queryinterfaced anymore.
  catch(error) {
    return null;
  }
}

// Takes a browser and returns `tab` it belongs to. Note that this
// won't handle nested browsers just a top level tab's browsers.
let getTabForBrowser = browser => {
  let { BrowserApp, gBrowser } = browser.ownerDocument.defaultView;
  return BrowserApp ?
    BrowserApp.getTabForBrowser(browser) :
  (gBrowser && gBrowser.browsers && gBrowser.tabs) ?
    gBrowser.tabs[gBrowser.browsers.indexOf(browser)] :
  null;
}
exports.getTabForBrowser = getTabForBrowser;

// Gets the tab containing the provided window.
let getTabForContentWindow = window => {
  return getTabs().find(tab => getTabContentWindow(tab) === window.top) || null;;
};
exports.getTabForContentWindow = getTabForContentWindow;


let setTabURL = (tab, url) => {
  let browser = getBrowserFor(tab)
  return browser && browser.loadURI(String(url));
};
exports.setTabURL = setTabURL;

// Takes a tab and returns `contentType` of the document loaded into it.
let getTabContentType = compose(query("contentDocument.contentType"),
                                getBrowserFor);
exports.getTabContentType = getTabContentType;

// Takes a window and returns selected tab on that window.
let getSelectedTab = compose(field("selectedTab"), getTabsFor);
exports.getSelectedTab = getSelectedTab;
exports.getActiveTab = getSelectedTab;

// Utility to notify that fennec isn't supported
let unsupportedOnFennec = _ => console.warn(FENNEC_UNSUPPORTED);

// Takes `tab` and pins it.
let pin = dispatcher("pin@tab");
pin.when(isXULTab, tab => {
  let gBrowser = getTabBrowser(tab);
  return gBrowser && gBrowser.pinTab(tab);
});
// Feature is not yet supported see Bug 782819
pin.when(isFennecTab, unsupportedOnFennec);

// Takes `tab` and unpins it.
let unpin = dispatcher("pin@tab");
unpin.when(isXULTab, tab => {
  let gBrowser = getTabBrowser(tab);
  return gBrowser && gBrowser.unpinTab(tab);
});
// Feature is not yet supported see Bug 782819
unpin.when(isFennecTab, unsupportedOnFennec);
exports.unpin = unpin;

let isPinned = dispatcher("pinned?@tab");
isPinned.when(isXULTab, compose(Boolean, field("pinned")));
// Feature is not yet supported see Bug 782819
isPinned.when(isFennecTab, compose(constant(null), unsupportedOnFennec));

// Get's tab and reloads document in it.
let reload = compose(browser => browser && browser.reload(),
                     getBrowserFor);
exports.reload = reload;

// Takes a `tab` and returns it's index in the window.
let getIndex = dispatcher("index@tab");
getIndex.when(isXULTab, tab => {
  let gBrowser = getTabBrowser(tab);
  let document = getBrowserFor(tab).documnet;
  return gBrowser && document && gBrowser.getBrowserIndexForDocument(document);
});
getIndex.when(isFennecTab,
               tab => getTabForContentWindow(getOwnerWindow(tab)).indexOf(tab));
exports.getIndex = getIndex;

let move = dispatcher("move@tab");
move.when(isXULTab, tab => {
  let gBrowser = getTabBrowser(tab);
  return gBrowser && gBrowser.moveTabTo(tab, index);
});
// TODO: Implement fennec support see Bug 782461
move.when(isFennecTab, unsupportedOnFennec);
exports.move = move;

let isActiveTab = tab =>
    isXULTab(tab) && tab === getSelectedTab(getOwnerWindow(tab))
exports.isActiveTab = isActiveTab;
