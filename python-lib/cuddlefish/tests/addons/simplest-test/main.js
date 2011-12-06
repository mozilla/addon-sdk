exports.main = function(options, callbacks) {
  // Close Firefox window. Firefox should quit.
  require("window-utils").activeBrowserWindow.close();
}
