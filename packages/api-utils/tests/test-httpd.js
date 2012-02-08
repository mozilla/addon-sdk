/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const port = 8080;
const file = require("api-utils/file");
const { pathFor } = require("api-utils/system");

exports.testBasicHTTPServer = function(test) {
  let basePath = pathFor("TmpD");
  let filePath = file.join(basePath, 'test-httpd.txt');
  let content = "This is the HTTPD test file.\n";
  let fileStream = file.open(filePath, 'w');
  fileStream.write(content);
  fileStream.close();

  let { startServerAsync } = require("httpd");
  let srv = startServerAsync(port, basePath);

  test.waitUntilDone();

  // Request this very file.
  let Request = require('request').Request;
  Request({
    url: "http://localhost:" + port + "/test-httpd.txt",
    onComplete: function (response) {
      test.assertEqual(response.text, content);
      done();
    }
  }).get();


  function done() {
    srv.stop(function() {
      test.done();
    });
  }
};
