/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*  Promise-style installer for a addons */


/*  references:

aInstall:  https://developer.mozilla.org/en-US/docs/Addons/Add-on_Manager/AddonInstall
aAddon:    https://developer.mozilla.org/en-US/docs/Addons/Add-on_Manager/Addon
Listener:  https://developer.mozilla.org/en-US/docs/Addons/Add-on_Manager/InstallListener

*/

const { Cc, Ci, Cu } = require("chrome");
const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm");
const { defer } = require("api-utils/promise");
const { setTimeout } = require("api-utils/timer");
const { Class, mix } = require('api-utils/heritage');

/**
 * `install` method error codes:
 *
 * https://developer.mozilla.org/en/Addons/Add-on_Manager/AddonManager#AddonInstall_errors
 */
exports.ERROR_NETWORK_FAILURE = AddonManager.ERROR_NETWORK_FAILURE;
exports.ERROR_INCORRECT_HASH = AddonManager.ERROR_INCORRECT_HASH;
exports.ERROR_CORRUPT_FILE = AddonManager.ERROR_CORRUPT_FILE;
exports.ERROR_FILE_ACCESS = AddonManager.ERROR_FILE_ACCESS;

/**
 * `install` listener events
 *
 * https://developer.mozilla.org/en-US/docs/Addons/Add-on_Manager/InstallListener
 */

// Listen for various install events.  Using a class here is possibly overkill.
// see git history for when this was a simpler object.

let Listener =  Class({
  initialize: function initialize(promise,resolve,reject) {
    // TODO, what should the args here be?  we need to bind to the promise.
    this.promise = promise;
    this.reject = reject;
    this.resolve = resolve;
  },
  //extends: EventTarget, // ?
  type: 'InstallEventListener',
  myself: this, // are we dancing too much here?
  onInstallEnded: function(aInstall, aAddon) {
    console.log('hooray, we finished the install!');
    aInstall.removeListener(this.myself);
    // Bug 749745: on FF14+, onInstallEnded is called just before `startup()`
    // is called, but we expect to resolve the promise only after it.
    // As startup is called synchronously just after onInstallEnded,
    // a simple setTimeout(0) is enough
    setTimeout(this.resolve, 0, aAddon); // return the whole addon
    //
  },
  onInstallFailed: function (aInstall) {
    console.log("failed");
    aInstall.removeListener(this.myself);
    console.log('I really truly failed');
    this.reject(aInstall.error);
  },
  onDownloadFailed: function(aInstall) {
    this.onInstallFailed(aInstall);
  },
  onNewInstall: function(aInstall){ console.log('NewInstall')},
  onDownloadStarted: function(aInstall){},
  onDownloadProgress: function(aInstall){},
  onDownloadEnded: function(aInstall){},
  onDownloadCancelled: function(aInstall){},
  onInstallStarted: function(aInstall){console.log('Install starting in listener')},
  onInstallCancelled: function(aInstall){},
  onExternalInstall: function(aInstall,aAddon,needsRestart){}

  // TODO, add 'hash failure?'
});


/**
 * Immediatly install an addon.
 *
 * @param {String} xpiPath
 *   file path to an xpi file to install
 * @return {Promise}
 *   A promise resolved when the addon is finally installed.
 *   Resolved with addon id as value or rejected with an error code.
 */

exports.installFile = function installFile(xpiPath) {
  console.log('into the install');
  let { promise, resolve, reject } = defer();

  // Create nsIFile for the xpi file
  let file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  try {
    file.initWithPath(xpiPath);
  }
  catch(e) {
    reject(exports.ERROR_FILE_ACCESS);
    return promise;
  }

  // Listen for installation end
  let listener = new Listener(promise,resolve,reject);
  console.log("made a listener");
  listener.onNewInstall(); // test some pipes

  // Order AddonManager to install the addon
  AddonManager.getInstallForFile(file, function(install) {
    install.addListener(listener);
    install.install();
  });

  return promise;
};


exports.install = exports.installFile;

exports.installUrl = function installUrl(url,hash,mimetype){
  let { promise, resolve, reject } = defer();

  if (mimetype === undefined) {mimetype = "application/x-xpinstall"};
  if (hash === undefined) {hash = ""};

  // TODO, should we download the file ourselves, then go with file?
  let listener = new Listener(promise,resolve,reject);
  console.log("made a listener");
  listener.onNewInstall();

  AddonManager.getInstallForURL(url, function(install) {
    install.addListener(listener);
    install.install();
  },
  mimetype,
  hash
  );
  return promise;
};

exports.uninstall = function uninstall(addonId) {
  let { promise, resolve, reject } = defer();

  // Listen for uninstallation end
  let listener = {
    onUninstalled: function onUninstalled(aAddon) {
      if (aAddon.id != addonId)
        return;
      AddonManager.removeAddonListener(listener);
      resolve(aAddon);
    }
  };
  AddonManager.addAddonListener(listener);

  // Order Addonmanager to uninstall the addon
  AddonManager.getAddonByID(addonId, function (aAddon) {
    aAddon.uninstall();
  });

  return promise;
};

exports.disable = function disable(addonId) {
  let { promise, resolve, reject } = defer();

  AddonManager.getAddonByID(addonId, function (aAddon) {
    aAddon.userDisabled = true;
    resolve(aAddon);
  });

  return promise;
};
