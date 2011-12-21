var url = require("url");

exports.testResolve = function(test) {
  test.assertEqual(url.URL("bar", "http://www.foo.com/").toString(),
                   "http://www.foo.com/bar");

  test.assertEqual(url.URL("bar", "http://www.foo.com"),
                   "http://www.foo.com/bar");

  test.assertEqual(url.URL("http://bar.com/", "http://foo.com/"),
                   "http://bar.com/",
                   "relative should override base");

  test.assertRaises(function() { url.URL("blah"); },
                    "malformed URI: blah",
                    "url.resolve() should throw malformed URI on base");

  test.assertRaises(function() { url.URL("chrome://global"); },
                    "invalid URI: chrome://global",
                    "url.resolve() should throw invalid URI on base");

  test.assertRaises(function() { url.URL("chrome://foo/bar"); },
                    "invalid URI: chrome://foo/bar",
                    "url.resolve() should throw on bad chrome URI");

  test.assertEqual(url.URL("", "http://www.foo.com"),
                   "http://www.foo.com/",
                   "url.resolve() should add slash to end of domain");
};

exports.testParseHttp = function(test) {
  var info = url.URL("http://foo.com/bar");
  test.assertEqual(info.scheme, "http");
  test.assertEqual(info.host, "foo.com");
  test.assertEqual(info.port, null);
  test.assertEqual(info.userPass, null);
  test.assertEqual(info.path, "/bar");
};

exports.testParseHttpWithPort = function(test) {
  var info = url.URL("http://foo.com:5/bar");
  test.assertEqual(info.port, 5);
};

exports.testParseChrome = function(test) {
  var info = url.URL("chrome://global/content/blah");
  test.assertEqual(info.scheme, "chrome");
  test.assertEqual(info.host, "global");
  test.assertEqual(info.port, null);
  test.assertEqual(info.userPass, null);
  test.assertEqual(info.path, "/content/blah");
};

exports.testParseAbout = function(test) {
  var info = url.URL("about:boop");
  test.assertEqual(info.scheme, "about");
  test.assertEqual(info.host, null);
  test.assertEqual(info.port, null);
  test.assertEqual(info.userPass, null);
  test.assertEqual(info.path, "boop");
};

exports.testParseFTP = function(test) {
  var info = url.URL("ftp://1.2.3.4/foo");
  test.assertEqual(info.scheme, "ftp");
  test.assertEqual(info.host, "1.2.3.4");
  test.assertEqual(info.port, null);
  test.assertEqual(info.userPass, null);
  test.assertEqual(info.path, "/foo");
};

exports.testParseFTPWithUserPass = function(test) {
  var info = url.URL("ftp://user:pass@1.2.3.4/foo");
  test.assertEqual(info.userPass, "user:pass");
};

exports.testURL = function(test) {
  let URL = url.URL;
  test.assert(URL("h:foo") instanceof URL, "instance is of correct type");
  test.assertRaises(function() URL(),
                    "malformed URI: undefined",
                    "url.URL should throw on undefined");
  test.assertRaises(function() URL(""),
                    "malformed URI: ",
                    "url.URL should throw on empty string");
  test.assertRaises(function() URL("foo"),
                    "malformed URI: foo",
                    "url.URL should throw on invalid URI");
  test.assert(URL("h:foo").scheme, "has scheme");
  test.assertEqual(URL("h:foo").toString(),
                   "h:foo",
                   "toString should roundtrip");
  // test relative + base
  test.assertEqual(URL("mypath", "http://foo").toString(), 
                   "http://foo/mypath",
                   "relative URL resolved to base");
  // test relative + no base
  test.assertRaises(function() URL("path").toString(), 
                    "malformed URI: path",
                    "no base for relative URI should throw");

  let a = URL("h:foo");
  let b = URL(a);
  test.assertEqual(b.toString(),
                   "h:foo",
                   "a URL can be initialized from another URL");
  test.assertNotStrictEqual(a, b,
                            "a URL initialized from another URL is not the same object");
  test.assert(a == "h:foo",
              "toString is implicit when a URL is compared to a string via ==");
  test.assertStrictEqual(a + "", "h:foo",
                         "toString is implicit when a URL is concatenated to a string");
};

exports.testStringInterface = function(test) {
  let URL = url.URL;
  var EM = "about:addons";
  var a = URL(EM);

  // make sure the standard URL properties are enumerable and not the String interface bits
  test.assertEqual(Object.keys(a), "scheme,userPass,host,port,path", "enumerable key list check for URL.");
  test.assertEqual(
      JSON.stringify(a),
      "{\"scheme\":\"about\",\"userPass\":null,\"host\":null,\"port\":null,\"path\":\"addons\"}",
      "JSON.stringify should return a object with correct props and vals.");

  // make sure that the String interface exists and works as expected
  test.assertEqual(a.indexOf(":"), EM.indexOf(":"), "indexOf on URL works");
  test.assertEqual(a.valueOf(), EM.valueOf(), "valueOf on URL works.");
  test.assertEqual(a.toSource(), EM.toSource(), "toSource on URL works.");
  test.assertEqual(a.lastIndexOf("a"), EM.lastIndexOf("a"), "lastIndexOf on URL works.");
  test.assertEqual(a.match("t:").toString(), EM.match("t:").toString(), "match on URL works.");
  test.assertEqual(a.toUpperCase(), EM.toUpperCase(), "toUpperCase on URL works.");
  test.assertEqual(a.toLowerCase(), EM.toLowerCase(), "toLowerCase on URL works.");
  test.assertEqual(a.split(":").toString(), EM.split(":").toString(), "split on URL works.");
  test.assertEqual(a.charAt(2), EM.charAt(2), "charAt on URL works.");
  test.assertEqual(a.charCodeAt(2), EM.charCodeAt(2), "charCodeAt on URL works.");
  test.assertEqual(a.concat(EM), EM.concat(a), "concat on URL works.");
  test.assertEqual(a.substr(2,3), EM.substr(2,3), "substr on URL works.");
  test.assertEqual(a.substring(2,3), EM.substring(2,3), "substring on URL works.");
  test.assertEqual(a.trim(), EM.trim(), "trim on URL works.");
  test.assertEqual(a.trimRight(), EM.trimRight(), "trimRight on URL works.");
  test.assertEqual(a.trimLeft(), EM.trimLeft(), "trimLeft on URL works.");
}
