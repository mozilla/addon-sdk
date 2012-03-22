/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/Services.jsm");

const DEBUG = false;

let log = DEBUG ? dump : function (){};


function startup(data, reason) {
  // This code allow to make all stdIO work
  try {
    Components.utils.import("resource://gre/modules/ctypes.jsm");
    let libdvm = ctypes.open("libdvm.so");
    let dvmStdioConverterStartup = libdvm.declare("dvmStdioConverterStartup", ctypes.default_abi, ctypes.void_t);
    dvmStdioConverterStartup();
    log("MU: console redirected to adb logcat.\n");
  } catch(e) {
    Cu.reportError("MU: unable to execute jsctype hack: "+e);
  }

  // This code allow to kill firefox from adb
  try {
    let Watcher = {
      window: null,
      onOpenWindow: function(window) {
        window = window.docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
        window.addEventListener("keydown", this, true);
      },
      onCloseWindow: function (window) {},
      onWindowTitleChange: function () {},
      handleEvent: function(event) {
        // This event is dispatched via: abd shell input keycode 19
        // KEYCODE_DPAD_UP = 19, UP can't be fired by virtual keyboard,
        // so it should be safe to take this event as a kill signal.
        // `adb shell input` and `JS keyCode` values doesn't map to same values
        // In JS, KeyUp maps to DOM_VK_UP = 38:
        // https://developer.mozilla.org/en/DOM/KeyboardEvent
        if (event.keyCode == 38 && event.which == 38) {
          Cu.reportError("Mobile killer triggered!");
          let appStartup = Cc['@mozilla.org/toolkit/app-startup;1'].
            getService(Ci.nsIAppStartup);
          appStartup.quit(Ci.nsIAppStartup.eForceQuit);
        }
      }
    };
    Services.wm.addListener(Watcher);
    log("MU: key listener to close firefox set.\n");
  }
  catch(e) {
    log("MU: Unable to register window watcher: " + e + "\n");
  }

  try {
    let QuitObserver = {
      observe: function (aSubject, aTopic, aData) {
        Services.obs.removeObserver(QuitObserver, "quit-application", false);
        dump("MU: APPLICATION-QUIT\n");
      }
    };
    Services.obs.addObserver(QuitObserver, "quit-application", false);
    log("MU: ready to watch firefox exit.\n");
  } catch(e) {
    log("MU: unable to register quit-application observer: " + e + "\n");
  }
}

function install() {}
function shutdown() {}
