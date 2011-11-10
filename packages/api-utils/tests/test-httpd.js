exports.testBasicHTTPServer = function(test) {
  var port = 8080;
  var data = require("self").data;
  var testFilePath = require("url").toFilename(data.url("test-httpd.txt"));
  var basePath = require("file").dirname(testFilePath);
  var {startServerAsync} = require("httpd")

  var srv = startServerAsync(port, basePath);

  test.waitUntilDone();
  
  // Request this very file.
  var Request = require('request').Request;
  Request({
    url: "http://localhost:" + port + "/test-httpd.txt",
    onComplete: function (response) {
      test.assertEqual(response.text, "This is the HTTPD test file.");
      done();
    }
  }).get();


  function done() {
    srv.stop(function() {
      test.pass();
      test.done();
    });
  }
};
