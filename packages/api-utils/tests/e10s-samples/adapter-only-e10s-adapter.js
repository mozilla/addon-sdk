if (this.chrome) {
  exports.use = function(a, b) {
    return chrome.call("superpower", a, b);
  };
} else {
  exports.register = function(addon) {
    addon.on("superpower", function(name, a, b) {
      return "hello " + a + " " + b;
    });
  };
}
