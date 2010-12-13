if (this.chrome) {
  exports.use = function(a, b) {
    return chrome.call("superpower", a, b);
  };
} else {
  exports.register = function(process) {
    process.registerReceiver("superpower", function(name, a, b) {
      return "hello " + a + " " + b;
    });
  };
}
