exports.testSelf = function(test) {
  var self = require("self");
  // We can't assert anything about the ID inside the unit test right now,
  // because the ID we get depends upon how the test was invoked. The idea
  // is that it is supposed to come from the main top-level package's
  // package.json file, from the "id" key.
  test.assertEqual(typeof(self.id), "string", "self.id is a string");
  test.assert(self.id.length > 0);

  var source = self.data.load("test-content-symbiont.js");
  test.assert(source.match(/test-content-symbiont/), "self.data.load() works");

  // Likewise, we can't assert anything about the full URL, because that
  // depends on self.id . We can only assert that it ends in the right
  // thing.
  var url = self.data.url("test-content-symbiont.js");
  test.assertEqual(typeof(url), "string", "self.data.url('x') returns string");
  test.assertEqual(/\/test-content-symbiont\.js$/.test(url), true);

  // Make sure 'undefined' is not in url when no string is provided.
  url = self.data.url();
  test.assertEqual(typeof(url), "string", "self.data.url() returns string");
  test.assertEqual(/\/undefined$/.test(url), false);

  // When tests are run on just the api-utils package, self.name is
  // api-utils and the version is whatever packages/api-utils/package.json
  // contains (usually the same as the overall SDK version, but let's not
  // enforce that). When they're run as 'cfx testall', self.name is testpkgs,
  // and the version is "fake" because python-lib/cuddlefish/__init__.py
  // makes a fake package.json Bunch in test_all_packages().
  test.assert((self.name == "api-utils") || (self.name == "testpkgs"),
              "self.name is api-utils or testpkgs");
  test.assertEqual(typeof(self.version), "string", "self.version exists");
};
