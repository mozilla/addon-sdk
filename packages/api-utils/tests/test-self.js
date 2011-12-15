"use strict";

const { URL } = require('url');

exports.testSelf = function(test) {
  let self = require("self");

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
  let url = self.data.url("test-content-symbiont.js");
  test.assert(url instanceof URL, "self.data.url('x') returns URL");
  test.assertEqual(/\/test-content-symbiont\.js$/.test(url), true);

  // Make sure 'undefined' is not in url when no string is provided.
  url = self.data.url();
  test.assert(url instanceof URL, "self.data.url('x') returns URL");
  test.assertEqual(/\/undefined$/.test(url), false);

  // When tests are run on just the api-utils package, self.name is
  // api-utils. When they're run as 'cfx testall', self.name is testpkgs.
  test.assert((self.name == "api-utils") || (self.name == "testpkgs"),
              "self.name is api-utils or testpkgs");
};
