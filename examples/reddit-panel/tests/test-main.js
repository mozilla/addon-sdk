const m = require("main");
const self = require("self");

exports.testMain = function(test) {
  var callbacks = { quit: function() {
    test.pass();
    test.done();
  } };

  test.waitUntilDone();
  // Make sure it doesn't crash...
  m.main({ staticArgs: {quitWhenDone: true} }, callbacks);
};

exports.testData = function(test) {
  test.assert(self.data.load("panel.js").length > 0);
};
