/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Request } = require("sdk/request");
const { pathFor } = require("sdk/system");
const { startServerAsync } = require("sdk/test/httpd");
const file = require("sdk/io/file");

const basePath = pathFor("TmpD")
const port = 8099;


exports.testOptionsValidator = function(test) {
  // First, a simple test to make sure we didn't break normal functionality.
  test.assertRaises(function () {
    Request({
      url: null
    });
  }, 'The option "url" must be one of the following types: string');

  // Next we'll have a Request that doesn't throw from c'tor, but from a setter.
  let req = Request({
    url: "http://playground.zpao.com/jetpack/request/text.php",
    onComplete: function () {}
  });
  test.assertRaises(function () {
    req.url = null;
  }, 'The option "url" must be one of the following types: string');
  // The url shouldn't have changed, so check that
  test.assertEqual(req.url, "http://playground.zpao.com/jetpack/request/text.php");
}

exports.testContentValidator = function(test) {
  test.waitUntilDone();
  Request({
    url: "data:text/html;charset=utf-8,response",
    content: { 'key1' : null, 'key2' : 'some value' },
    onComplete: function(response) {
      test.assertEqual(response.text, "response?key1=null&key2=some+value");
      test.done();
    }
  }).get();
};

// All tests below here require a network connection. They will be commented out
// when checked in. If you'd like to run them, simply uncomment them.
//
// When we have the means, these tests will be converted so that they don't
// require an external server nor a network connection.

// This is a request to a file that exists.
exports.testStatus200 = function (test) {
  let srv = startServerAsync(port, basePath);
  let content = "Look ma, no hands!\n";
  let basename = "test-request.txt"
  prepareFile(basename, content);

  test.waitUntilDone();
  var req = Request({
    url: "http://localhost:" + port + "/" + basename,
    onComplete: function (response) {
      test.assertEqual(this, req, "`this` should be request");
      test.assertEqual(response.status, 200);
      test.assertEqual(response.statusText, "OK");
      test.assertEqual(response.headers["Content-Type"], "text/plain");
      test.assertEqual(response.text, content);
      srv.stop(function() test.done());
    }
  }).get();
}

// This tries to get a file that doesn't exist
exports.testStatus404 = function (test) {
  var srv = startServerAsync(port, basePath);

  test.waitUntilDone();
  Request({
    // the following URL doesn't exist
    url: "http://localhost:" + port + "/test-request-404.txt",
    onComplete: function (response) {
      test.assertEqual(response.status, 404);
      test.assertEqual(response.statusText, "Not Found");
      srv.stop(function() test.done());
    }
  }).get();
}

/*
// a simple file with a known header
exports.testKnownHeader = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/headers.php",
    onComplete: function (response) {
      test.assertEqual(response.headers["x-zpao-header"], "Jamba Juice");
      test.done();
    }
  }).get();
}

// complex headers
exports.testKnownHeader = function (test) {
  let headers = {
    "x-zpao-header": "Jamba Juice is: delicious",
    "x-zpao-header-2": "foo, bar",
    "Set-Cookie": "foo=bar\nbaz=foo"
  }
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/complex_headers.php",
    onComplete: function (response) {
      for (k in headers) {
        test.assertEqual(response.headers[k], headers[k]);
      }
      test.done();
    }
  }).get();
}
*/

exports.testSimpleJSON = function (test) {
  let srv = startServerAsync(port, basePath);
  let json = { foo: "bar" };
  let basename = "test-request.json";
  prepareFile(basename, JSON.stringify(json));

  test.waitUntilDone();
  Request({
    url: "http://localhost:" + port + "/" + basename,
    onComplete: function (response) {
      assertDeepEqual(test, response.json, json);
      srv.stop(function() test.done());
    }
  }).get();
}

exports.testInvalidJSON = function (test) {
  let srv = startServerAsync(port, basePath);
  let basename = "test-request-invalid.json";
  prepareFile(basename, '"this": "isn\'t JSON"');

  test.waitUntilDone();
  Request({
    url: "http://localhost:" + port + "/" + basename,
    onComplete: function (response) {
      test.assertEqual(response.json, null);
      srv.stop(function() test.done());
    }
  }).get();
}

/*
exports.testGetWithParamsNotContent = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php?foo=bar",
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : { foo: "bar" }
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}

exports.testGetWithContent = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php",
    content: { foo: "bar" },
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : { foo: "bar" }
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}

exports.testGetWithParamsAndContent = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php?foo=bar",
    content: { baz: "foo" },
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : { foo: "bar", baz: "foo" }
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}

exports.testSimplePost = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php",
    content: { foo: "bar" },
    onComplete: function (response) {
      let expected = {
        "POST": { foo: "bar" },
        "GET" : []
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).post();
}

exports.testEncodedContent = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php",
    content: "foo=bar&baz=foo",
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : { foo: "bar", baz: "foo" }
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}

exports.testEncodedContentWithSpaces = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php",
    content: "foo=bar+hop!&baz=foo",
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : { foo: "bar hop!", baz: "foo" }
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}

exports.testGetWithArray = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php",
    content: { foo: [1, 2], baz: "foo" },
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : { foo: [1, 2], baz: "foo" }
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}

exports.testGetWithNestedArray = function (test) {
  test.waitUntilDone();
  Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php",
    content: { foo: [1, 2, [3, 4]], bar: "baz" },
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : this.content
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}

exports.testGetWithNestedArray = function (test) {
  test.waitUntilDone();
  let request = Request({
    url: "http://playground.zpao.com/jetpack/request/getpost.php",
    content: {
      foo: [1, 2, {
        omg: "bbq",
        "all your base!": "are belong to us"
      }],
      bar: "baz"
    },
    onComplete: function (response) {
      let expected = {
        "POST": [],
        "GET" : request.content
      };
      assertDeepEqual(test, response.json, expected);
      test.done();
    }
  }).get();
}
*/

// This is not a proper testing for deep equal, but it's good enough for my uses
// here. It will do type coercion to check equality, but that's good here. Data
// coming from the server will be stringified and so "0" should be equal to 0.
function assertDeepEqual(test, obj1, obj2, msg) {
  function equal(o1, o2) {
    // cover our non-object cases well enough
    if (o1 == o2)
      return true;
    if (typeof(o1) != typeof(o2))
      return false;
    if (typeof(o1) != "object")
      return o1 == o2;

    let e = true;
    for (let key in o1) {
      let val = o1[key];
      e = e && key in o2 && equal(o2[key], val);
      if (!e)
        break;
    }
    for (let key in o2) {
      let val = o2[key]
      e = e && key in o1 && equal(o1[key], val);
      if (!e)
        break;
    }
    return e;
  }
  msg = msg || "objects not equal - " + JSON.stringify(obj1) + " != " +
               JSON.stringify(obj2);
  test.assert(equal(obj1, obj2), msg);
}

function prepareFile(basename, content) {
  let filePath = file.join(basePath, basename);
  let fileStream = file.open(filePath, 'w');
  fileStream.write(content);
  fileStream.close();
}
