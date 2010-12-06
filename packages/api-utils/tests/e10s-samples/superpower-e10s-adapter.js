if (this.sendMessage) {
  exports.use = function(a, b) {
    return callMessage("superpower", a, b)[0];
  };
} else {
  var superpower = require("e10s-samples/superpower");

  exports.register = function(process) {
    process.registerReceiver("superpower", function(name, a, b) {
      return superpower.use(a, b);
    });
  };
}
