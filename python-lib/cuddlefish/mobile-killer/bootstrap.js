/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/Services.jsm");

function startup(data, reason) {
  // Activate stderr/stdout redirection to logcat.
  //
  // This is a really basic approach. A proper implementation will be done by
  // the bug 689777.
  try {
    Cu.import("resource://gre/modules/ctypes.jsm");

    ctypes.open("libdvm.so")
      .declare("dvmStdioConverterStartup", ctypes.default_abi, ctypes.void_t)();
  } catch(e) {
    Cu.reportError("Mobile Killer: Unable to execute jsctype hack: " +  e);
  }

  let Watcher = {
    window: null,
    onOpenWindow: function(window) {
      window = window.docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
      window.addEventListener("keydown", this, true);
    },
    onWindowTitleChange: function () {},
    handleEvent: function(event) {
      // This event is dispatched via: abd shell input keycode 19
      // KEYCODE_DPAD_UP=19, UP can't be fired by virtual keyboard,
      // so it should be safe to take this event as a kill signal.
      if (event.keyCode == 38 && event.which == 38) {
        Cu.reportError("Mobile killer triggered!");
        let appStartup = Cc['@mozilla.org/toolkit/app-startup;1'].
          getService(Ci.nsIAppStartup);
        appStartup.quit(Ci.nsIAppStartup.eForceQuit);
      }
    }
  };
  Services.wm.addListener(Watcher);
  Cu.reportError("Mobile killer ready to kill firefox.");
}

function install() {}
function shutdown() {}
