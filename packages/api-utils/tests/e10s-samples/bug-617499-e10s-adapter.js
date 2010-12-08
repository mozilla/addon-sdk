if (this.sendMessage) {
  // TODO: register receiver for async msg.
  registerReceiver("asyncy", function() {
    console.log("i am an async message from firefox");
  });
  exports.go = function() {
    console.log("about to send sync message to firefox");
    callMessage("superpower");
    console.log("returned from sync message to firefox");
  };
} else {
  exports.register = function(process) {
    process.registerReceiver("superpower", function(name) {
      process.sendMessage("asyncy");
    });
  };
}
