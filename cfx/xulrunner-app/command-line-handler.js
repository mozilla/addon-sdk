/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

/**
 * This XPCOM component allows to run an sdk addon as a xulrunner application.
 * This nsICommandLineHandler is instanciated on application startup
 * and will allow us to catch command line arguments in order to make them
 * available to the addon.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

/*
// Give access to nsICommandLine object
// + two methods to control application quit
CommandLine: Object.create(cmdLine, {
  waitBeforeQuitting: { value: function () {
    Services.startup.enterLastWindowClosingSurvivalArea();
  }},
  quit: { value: function () {
    Services.startup.exitLastWindowClosingSurvivalArea();
    Services.startup.quit(Services.startup.eAttemptQuit);
  }}
})
*/

// This method is called by nsICommandLineHandler object defined at EOF
function runApplication(cmdLine) {
  // Enable stdout output
  Services.prefs.setBoolPref("browser.dom.window.dump.enabled", true);

  // Flush startup cache in order to avoid using an old bootstrap.js version
  // Take care that this file (CommandLineHandler.js) is always cached!
  Services.obs.notifyObservers(null, "startupcache-invalidate", null);
  try {
    let baseURI = "resource://app/";
    let xpiJarURI = Services.io.newURI("jar:" + baseURI + "cfx.xpi!/",
                                       null,
                                       null);

    // Finally evaluate bootstrap.js from the xpi
    let bootstrap = {};
    Services.scriptloader.loadSubScript(
      xpiJarURI.spec + "bootstrap.js",
      bootstrap);

    // data object sent to bootstrap's startup method:
    // An object crafted by AddonManager code, but jetpack only uses
    // resourceURI attribute
    let data = {
      resourceURI: xpiJarURI
    };

    // load reason code, always use 'enable'
    let reasonCode = 3;

    // Fake AddonManager behavior by calling startup method
    bootstrap.startup(data, reasonCode);
  }
  catch(e) {
    let msg = "Exception while running boostrap.js:\n" + e + "\n" + e.stack;
    dump(msg);
    Cu.reportError(msg);
  }
}

// Register a nsICommandLineHandler xpcom object in order to call
// runApplication method at application startup
function CommandLineHandler() {}
CommandLineHandler.prototype = {
  classID: Components.ID("{537df286-d9ae-4c7a-a633-6266b1325289}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),
  handle: runApplication,
  helpInfo : "",
};

let components = [CommandLineHandler];
let NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
