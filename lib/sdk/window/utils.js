/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'unstable'
};

const { Cc, Ci } = require('chrome');
const array = require('../util/array');

const windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].
                       getService(Ci.nsIWindowWatcher);
const appShellService = Cc['@mozilla.org/appshell/appShellService;1'].
                        getService(Ci.nsIAppShellService);
const windowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].
           getService(Ci.nsIWindowMediator);
const ioService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);

const BROWSER = 'navigator:browser',
      URI_BROWSER = 'chrome://browser/content/browser.xul',
      NAME = '_blank',
      FEATURES = 'chrome,all,dialog=no';

function getMostRecentBrowserWindow() {
  return windowMediator.getMostRecentWindow(BROWSER);
}
exports.getMostRecentBrowserWindow = getMostRecentBrowserWindow;

function getHiddenWindow() {
  return appShellService.hiddenDOMWindow;
}
exports.getHiddenWindow = getHiddenWindow;

/**
 * Returns the ID of the window's current inner window.
 */
function getInnerId(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
                getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
};
exports.getInnerId = getInnerId;

/**
 * Returns the ID of the window's outer window.
 */
function getOuterId(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
                getInterface(Ci.nsIDOMWindowUtils).outerWindowID;
};
exports.getOuterId = getOuterId;

/**
 * Returns `nsIXULWindow` for the given `nsIDOMWindow`.
 */
function getXULWindow(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIWebNavigation).
    QueryInterface(Ci.nsIDocShellTreeItem).
    treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIXULWindow);
};
exports.getXULWindow = getXULWindow;

function getDOMWindow(xulWindow) {
  return xulWindow.QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIDOMWindow);
}
exports.getDOMWindow = getDOMWindow;

/**
 * Returns `nsIBaseWindow` for the given `nsIDOMWindow`.
 */
function getBaseWindow(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIWebNavigation).
    QueryInterface(Ci.nsIDocShell).
    QueryInterface(Ci.nsIDocShellTreeItem).
    treeOwner.
    QueryInterface(Ci.nsIBaseWindow);
}
exports.getBaseWindow = getBaseWindow;

function getWindowDocShell(window) window.gBrowser.docShell;
exports.getWindowDocShell = getWindowDocShell;

function getWindowLoadingContext(window) {
  return getWindowDocShell(window).
         QueryInterface(Ci.nsILoadContext);
}
exports.getWindowLoadingContext = getWindowLoadingContext;

/**
 * Removes given window from the application's window registry.
 * @params {nsIDOMWindow|nsIXULWindow} window
 */
function backgroundify(window) {
  let xulWindow = window instanceof Ci.nsIXULWindow ? window :
                  getXULWindow(window);
  appShellService.unregisterTopLevelWindow(xulWindow);

  return window;
}
exports.backgroundify = backgroundify;

/**
 * Takes hash of options and serializes it to a features string that
 * can be used passed to `window.open`. For more details on features string see:
 * https://developer.mozilla.org/en/DOM/window.open#Position_and_size_features
 */
function serializeFeatures(options) {
  return Object.keys(options).reduce(function(result, name) {
    let value = options[name];
    return result + ',' + name + '=' +
           (value === true ? 'yes' : value === false ? 'no' : value);
  }, '').substr(1);
}

/**
 * Opens a top level window and returns it's `nsIDOMWindow` representation.
 * @params {String} uri
 *    URI of the document to be loaded into window.
 * @params {nsIDOMWindow} options.parent
 *    Used as parent for the created window.
 * @params {String} options.name
 *    Optional name that is assigned to the window.
 * @params {Object} options.features
 *    Map of key, values like: `{ width: 10, height: 15, chrome: true }`.
 */
function open(uri, options) {
  options = options || {};
  return windowWatcher.
    openWindow(options.parent || null,
               uri,
               options.name || null,
               serializeFeatures(options.features || {}),
               options.args || null);
}
exports.open = open;

function make(options) {
  /**
  Opens top level window and return it's `nsIXULWindow` representation. Open
  window is not shown `unless` optional `options.show` is set to `true`.
  **/
  options = options || {};
  let show = options.show || false;
  let loadDefault = options.loadDefault !== false;
  let mask = options.mask || null;
  let width = options.width || null;
  let height = options.height || null;
  let appShell = options.shell || null;
  let uri = options.uri ? ioService.newURI(options.uri, null, null) : null;
  let parent = options.parent || null;

  return appShellService.createTopLevelWindow(parent, uri, show, loadDefault,
                                              mask, width, height, appShell);
}
exports.make = make;

/**
 * Opens a top level window and returns it's `nsIDOMWindow` representation.
 * Same as `open` but with more features
 * @param {Object} options
 *
 */
function openDialog(options) {
  options = options || {};

  let browser = windowMediator.getMostRecentWindow(BROWSER);
  return browser.openDialog.apply(
      browser,
      array.flatten([
        options.url || URI_BROWSER,
        options.name || '_blank',
        options.features || 'chrome,all,dialog=no',
        options.args || null
      ])
  );
}
exports.openDialog = openDialog;

/**
 * Returns an array of all currently opened windows.
 * Note that these windows may still be loading. Optionally takes
 * `type` argument in which case result will contain only windows
 * for that type.
 */
function windows(type) {
  let result = [];
  let enumerator = windowMediator.getEnumerator(type || null);
  while (enumerator.hasMoreElements()) {
    let window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);
    result.push(window);
  }
  return result;
}
exports.windows = windows;

/**
 * Check if the given window is completely loaded.
 * i.e. if its "load" event has already been fired and all possible DOM content
 * is done loading (the whole DOM document, images content, ...)
 * @params {nsIDOMWindow} window
 */
function isDocumentLoaded(window) {
  return window.document.readyState == "complete";
}
exports.isDocumentLoaded = isDocumentLoaded;

function isBrowser(window) {
  return window.document.documentElement.getAttribute("windowtype") === BROWSER;
};
exports.isBrowser = isBrowser;

function getWindowTitle(window) {
  return window && window.document ? window.document.title : null;
}
exports.getWindowTitle = getWindowTitle;

function isXULBrowser(window) {
  return !!(isBrowser(window) && window.XULBrowserWindow);
}
exports.isXULBrowser = isXULBrowser;

/**
 * Returns the most recent focused window
 */
function getFocusedWindow() {
  let window = getMostRecentBrowserWindow();
  return window ? window.document.commandDispatcher.focusedWindow : null;
}
exports.getFocusedWindow = getFocusedWindow;

/**
 * Returns the focused element in the most recent focused window
 */
function getFocusedElement() {
  let window = getMostRecentBrowserWindow();
  return window ? window.document.commandDispatcher.focusedElement : null;
}
exports.getFocusedElement = getFocusedElement;

function getFrames(window) {
  return Array.slice(window.frames).reduce(function(frames, frame) {
    return frames.concat(frame, getFrames(frame))
  }, [])
}
exports.getFrames = getFrames;


function getOwnerBrowserWindow(node) {
  /**
  Takes DOM node and returns browser window that contains it.
  **/

  let window = node.ownerDocument.defaultView.top;
  // If anchored window is browser then it's target browser window.
  if (isBrowser(window)) return window;
  // Otherwise iterate over each browser window and find a one that
  // contains browser for the anchored window document.
  let document = window.document;
  let browsers = windows("navigator:browser");
  return find(browsers, function isTargetBrowser(window) {
    return !!window.gBrowser.getBrowserForDocument(document);
  });
}
exports.getOwnerBrowserWindow = getOwnerBrowserWindow;
