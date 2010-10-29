if (this.sendMessage) {
  exports.use = function(a, b) {
    return callMessage("superpower", a, b)[0];
  };
} else {
  exports.register = function(process) {
    process.registerReceiver("superpower", function(name, a, b) {
      return "hello " + a + " " + b;
    });
  };
}
