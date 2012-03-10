/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cc, Ci } = require('chrome');

const windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].
                       getService(Ci.nsIWindowWatcher);
const appShellService = Cc['@mozilla.org/appshell/appShellService;1'].
                        getService(Ci.nsIAppShellService);
const observers = require('api-utils/observer-service');

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
               null);
}
exports.open = open;
