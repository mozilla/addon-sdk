var url = require("url");
var file = require("file");
var {Cm,Ci} = require("chrome");
var options = require("@packaging");

exports.testPackaging = function(test) {
  test.assertEqual(options.main,
                   'test-harness/run-tests',
                   "main program should be the test harness");

  test.assertEqual(options.metadata['test-harness'].author,
                   'Atul Varma (http://toolness.com/)',
                   "packaging metadata should be available");
};
