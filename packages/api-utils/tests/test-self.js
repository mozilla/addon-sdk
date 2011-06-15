exports.testSelf = function(test) {
  var self = require("self");
  // We can't assert anything about the ID inside the unit test right now,
  // because the ID we get depends upon how the test was invoked. The idea
  // is that it is supposed to come from the main top-level package's
  // package.json file, from the "id" key.
  test.assertEqual(typeof(self.id), "string", "self.id is a string");
  test.assert(self.id.length > 0);

  var source = self.data.load("bootstrap-remote-process.js");
  test.assert(source.match(/registerReceiver/), "self.data.load() works");

  // Likewise, we can't assert anything about the full URL, because that
  // depends on self.id . We can only assert that it ends in the right
  // thing.
  var url = self.data.url("bootstrap-remote-process.js");
  test.assertEqual(typeof(url), "string", "self.data.url() returns string");
  test.assertEqual(/\/bootstrap-remote-process\.js$/.test(url), true);
};
