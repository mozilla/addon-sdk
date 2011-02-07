const m = require("main");
const self = require("self");

exports.testReplace = function(test) {
  const input = "Hello World";
  const output = m.replaceMom(input);
  test.assertEqual(output, "Hello Mom");
  var callbacks = { quit: function() {} };

  // Make sure it doesn't crash...
  m.main({ staticArgs: {} }, callbacks);
};

exports.testID = function(test) {
  // The ID is randomly generated during tests, so we cannot compare it against
  // anything in particular.  Just assert that it is not empty.
  test.assert(self.id.length > 0);
  test.assertEqual(self.data.url("sample.html"),
                   "resource://anonid0-reading-data-reading-data-data/sample.html");
};
