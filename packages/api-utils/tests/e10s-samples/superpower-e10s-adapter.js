if (this.chrome) {
  exports.use = function(a, b) {
    return chrome.call("superpower", a, b);
  };
} else {
  var superpower = require("e10s-samples/superpower");

  exports.register = function(process) {
    process.registerReceiver("superpower", function(name, a, b) {
      return superpower.use(a, b);
    });
  };
}
