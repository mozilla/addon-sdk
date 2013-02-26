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
const WM = Cc['@mozilla.org/appshell/window-mediator;1'].
           getService(Ci.nsIWindowMediator);

const observers = require('../deprecated/observer-service');
const { ignoreWindow } = require('../private-browsing/utils');

const BROWSER = 'navigator:browser',
      URI_BROWSER = 'chrome://browser/content/browser.xul',
      NAME = '_blank',
      FEATURES = 'chrome,all,dialog=no';

function getMostRecentBrowserWindow() {
  return getMostRecentWindow(BROWSER);
}
exports.getMostRecentBrowserWindow = getMostRecentBrowserWindow;

function getMostRecentWindow(type) {
  let window = WM.getMostRecentWindow(type);
  // if private browsing window is most recent and not supported,
  // then ignore it and return a non private window
  if (ignoreWindow(window)) {
    window = windows(type)[0];
    return window ? window : null;
  }
  return window;
}
exports.getMostRecentWindow = getMostRecentWindow;

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
 * Removes given window from the application's window registry. Unless
 * `options.close` is `false` window is automatically closed on application
 * quit.
 * @params {nsIDOMWindow} window
 * @params {Boolean} options.close
 */
function backgroundify(window, options) {
  let base = getBaseWindow(window);
  base.visibility = false;
  base.enabled = false;
  appShellService.unregisterTopLevelWindow(getXULWindow(window));
  if (!options || options.close !== false)
    observers.add('quit-application-granted', window.close.bind(window));

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

    // the chrome and private features are special
    if ((name == 'private' || name == 'chrome'))
      return result + ((value === true) ? ',' + name : '');

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
 *    Map of key, values like: `{ width: 10, height: 15, chrome: true, private: true }`.
 */
function open(uri, options) {
  options = options || {};
  let newWindow = windowWatcher.
    openWindow(options.parent || null,
               uri,
               options.name || null,
               serializeFeatures(options.features || {}),
               options.args || null);

  return newWindow;
}
exports.open = open;

function close(window, callback) {
  if (callback) {
    // Wait for the window unload before ending test
    window.addEventListener("unload", function onunload() {
      window.removeEventListener("unload", onunload, false);
      callback();
    }, false);
  }

  window.close();
}
exports.close = close;


function onFocus(window, callback) {
  // ignore private windows if they are not supported
  if (ignoreWindow(window))
    return;

  // Based on SimpleTest.waitForFocus
  let fm = Cc["@mozilla.org/focus-manager;1"].
           getService(Ci.nsIFocusManager);

  var childTargetWindow = {};
  fm.getFocusedElementForWindow(window, true, childTargetWindow);
  childTargetWindow = childTargetWindow.value;

  var focusedChildWindow = {};
  if (fm.activeWindow) {
    fm.getFocusedElementForWindow(fm.activeWindow, true, focusedChildWindow);
    focusedChildWindow = focusedChildWindow.value;
  }

  var focused = (focusedChildWindow == childTargetWindow);
  if (focused) {
    callback();
  }
  else {
    childTargetWindow.addEventListener("focus", function focusListener() {
      childTargetWindow.removeEventListener("focus", focusListener, true);
      callback();
    }, true);
  }
}
exports.onFocus = onFocus;

/**
 * Opens a top level window and returns it's `nsIDOMWindow` representation.
 * Same as `open` but with more features
 * @param {Object} options
 *
 */
function openDialog(options) {
  options = options || {};

  let features = options.features || FEATURES;
  if (!!options.private &&
      !array.has(features.toLowerCase().split(','), 'private')) {
    features = features.split(',').concat('private').join(',');
  }

  let browser = getMostRecentBrowserWindow();

  // if there is no browser then do nothing
  if (!browser)
    return undefined;

  let newWindow = browser.openDialog.apply(
      browser,
      array.flatten([
        options.url || URI_BROWSER,
        options.name || NAME,
        features,
        options.args || null
      ])
  );

  return newWindow;
}
exports.openDialog = openDialog;

/**
 * Returns an array of all currently opened windows.
 * Note that these windows may still be loading.
 */
function windows(type) {
  let list = [];
  let winEnum = WM.getEnumerator(type);
  while (winEnum.hasMoreElements()) {
    let window = winEnum.getNext().QueryInterface(Ci.nsIDOMWindow);
    // only add unprivate windows when pb is not supported
    if (!ignoreWindow(window)) {
      list.push(window);
    }
  }
  return list;
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
  if (!(window instanceof Ci.nsIDOMWindow))
    return false;
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
  let window = WM.getMostRecentWindow(BROWSER);

  // if private browsing window is most recent and not supported,
  // then ignore it and return `null`, because the focused window
  // can't be targeted
  if (ignoreWindow(window))
    return null;

  return window ? window.document.commandDispatcher.focusedWindow : null;
}
exports.getFocusedWindow = getFocusedWindow;

/**
 * Returns the focused element in the most recent focused window
 */
function getFocusedElement() {
  let window = WM.getMostRecentWindow(BROWSER);

  // if private browsing window is most recent and not supported,
  // then ignore it and return `null`, because the focused element
  // can't be targeted
  if (ignoreWindow(window))
    return null;

  return window ? window.document.commandDispatcher.focusedElement : null;
}
exports.getFocusedElement = getFocusedElement;

function getFrames(window) {
  // ignore private windows when they are not supported
  if (ignoreWindow(window))
    return [];
  return Array.slice(window.frames).reduce(function(frames, frame) {
    return frames.concat(frame, getFrames(frame))
  }, [])
}
exports.getFrames = getFrames;
