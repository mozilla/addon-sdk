exports.main = function(options, callbacks) {
  // Tell Firefox to quit immediatly
  //callbacks.quit();
  require("window-utils").activeBrowserWindow.close();
}
