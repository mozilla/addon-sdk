exports.testSelf = function(test) {
  var self = require("self");
  test.assertEqual(typeof(self.id), "string", "self.id is a string");
  test.assertEqual(self.name, "api-utils", "self.name is the package name");

  var source = self.data.load("bootstrap-remote-process.js");
  test.assert(source.match(/registerReceiver/), "self.data.load() works");

  var url = self.data.url("bootstrap-remote-process.js");
  test.assertEqual(typeof(url), "string", "self.data.url() returns string");
};
