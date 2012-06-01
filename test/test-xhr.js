/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var xhr = require("xhr");
var timer = require("timer");
var { Loader } = require("test-harness/loader");
var xulApp = require("xul-app");

/* Test is intentionally disabled until platform bug 707256 is fixed.
exports.testAbortedXhr = function(test) {
  var req = new xhr.XMLHttpRequest();
  test.assertEqual(xhr.getRequestCount(), 1);
  req.abort();
  test.assertEqual(xhr.getRequestCount(), 0);
};
*/

exports.testLocalXhr = function(test) {
  var req = new xhr.XMLHttpRequest();
  req.overrideMimeType("text/plain");
  req.open("GET", module.uri);
  req.onreadystatechange = function() {
    if (req.readyState == 4 && req.status == 0) {
      test.assertMatches(req.responseText,
                         /onreadystatechange/,
                         "XMLHttpRequest should get local files");
      timer.setTimeout(
        function() { test.assertEqual(xhr.getRequestCount(), 0);
                     test.done(); },
        0
      );
    }
  };
  req.send(null);
  test.assertEqual(xhr.getRequestCount(), 1);
  test.waitUntilDone(4000);
};

exports.testUnload = function(test) {
  var loader = Loader(module);
  var sbxhr = loader.require("xhr");
  var req = new sbxhr.XMLHttpRequest();
  req.overrideMimeType("text/plain");
  req.open("GET", module.uri);
  req.send(null);
  test.assertEqual(sbxhr.getRequestCount(), 1);
  loader.unload();
  test.assertEqual(sbxhr.getRequestCount(), 0);
};

exports.testResponseHeaders = function(test) {
  var req = new xhr.XMLHttpRequest();
  req.overrideMimeType("text/plain");
  req.open("GET", module.uri);
  req.onreadystatechange = function() {
    if (req.readyState == 4 && req.status == 0) {
      var headers = req.getAllResponseHeaders();
      if (xulApp.versionInRange(xulApp.platformVersion, "13.0a1", "*")) {
        // Now that bug 608939 is FIXED, headers works correctly on files:
        test.assertEqual(headers, "Content-Type: text/plain\n",
                         "XHR's headers are valid");
      }
      else {
        test.assert(headers === null || headers === "",
                    "XHR's headers are empty");
      }
      test.done();
    }
  };
  req.send(null);
  test.assertEqual(xhr.getRequestCount(), 1);
  test.waitUntilDone(4000);
}

