const { Cc, Ci } = require("chrome");

exports.main = function(options, callbacks) {
  // Close Firefox window. Firefox should quit.
  require("api-utils/window-utils").activeBrowserWindow.close();

  // But not on Mac where it stay alive! We have to request application quit.
  if (require("api-utils/runtime").OS == "Darwin") {
    let appStartup = Cc['@mozilla.org/toolkit/app-startup;1'].
                     getService(Ci.nsIAppStartup);
    appStartup.quit(appStartup.eAttemptQuit);
  }
}
