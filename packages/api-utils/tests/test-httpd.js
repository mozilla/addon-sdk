exports.testBasicHTTPServer = function(test) {
  var port = 8080;
  var basePath = require("file").dirname( // the directory...
                   require("url").toFilename(__url__)); // ...this file is in
  var {startServerAsync} = require("httpd")

  var srv = startServerAsync(port, basePath);

  test.waitUntilDone();
  
  // Request this very file.
  var Request = require('request').Request;
  Request({
    url: "http://localhost:" + port + "/test-httpd.js",
    onComplete: function (response) {
      test.assertEqual(response.text.indexOf(
        "exports.testBasicHTTPServer = function(test) {"), 0);
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
