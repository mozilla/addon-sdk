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

exports.testToFilename = function(test) {
  test.assertRaises(
    function() { url.toFilename("resource://nonexistent"); },
    "resource does not exist: resource://nonexistent/",
    "url.toFilename() on nonexistent resources should throw"
  );

  test.assertMatches(url.toFilename(module.uri),
                     /.*test-url\.js$/,
                     "url.toFilename() on resource: URIs should work");

  test.assertRaises(
    function() { url.toFilename("http://foo.com/"); },
    "cannot map to filename: http://foo.com/",
    "url.toFilename() on http: URIs should raise error"
  );

  try {
    test.assertMatches(
      url.toFilename("chrome://global/content/console.xul"),
      /.*console\.xul$/,
      "url.toFilename() w/ console.xul works when it maps to filesystem"
    );
  } catch (e) {
    if (/chrome url isn\'t on filesystem/.test(e.message))
      test.pass("accessing console.xul in jar raises exception");
    else
      test.fail("accessing console.xul raises " + e);
  }

  // TODO: Are there any chrome URLs that we're certain exist on the
  // filesystem?
  // test.assertMatches(url.toFilename("chrome://myapp/content/main.js"),
  //                    /.*main\.js$/);
};

exports.testFromFilename = function(test) {
  var fileUrl = url.fromFilename(url.toFilename(module.uri));
  test.assertEqual(url.URL(fileUrl).scheme, 'file',
                   'url.toFilename() should return a file: url');
  test.assertEqual(url.fromFilename(url.toFilename(fileUrl)),
                   fileUrl);
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

var parseTests = {
  'HTTP://www.example.com/' : {
    'href': 'http://www.example.com/',
    'protocol': 'http:',
    'slashes': true,
    'host': 'www.example.com',
    'hostname': 'www.example.com',
    'pathname': '/',
    'path': '/'
  },
  'http://www.ExAmPlE.com/' : {
    'href': 'http://www.example.com/',
    'protocol': 'http:',
    'slashes': true,
    'host': 'www.example.com',
    'hostname': 'www.example.com',
    'pathname': '/',
    'path': '/'
  },
  'http://user:pw@www.ExAmPlE.com/' : {
    'href': 'http://user:pw@www.example.com/',
    'protocol': 'http:',
    'slashes': true,
    'auth': 'user:pw',
    'host': 'www.example.com',
    'hostname': 'www.example.com',
    'pathname': '/',
    'path': '/'
  },
  'http://USER:PW@www.ExAmPlE.com/' : {
    'href': 'http://USER:PW@www.example.com/',
    'protocol': 'http:',
    'slashes': true,
    'auth': 'USER:PW',
    'host': 'www.example.com',
    'hostname': 'www.example.com',
    'pathname': '/',
    'path': '/'
  },
  'HTTP://X.COM/Y' : {
    'href': 'http://x.com/Y',
    'protocol': 'http:',
    'slashes': true,
    'host': 'x.com',
    'hostname': 'x.com',
    'pathname': '/Y',
    'path': '/Y'
  },
  'http://www.narwhaljs.org/blog/categories?id=news' : {
    'href': 'http://www.narwhaljs.org/blog/categories?id=news',
    'protocol': 'http:',
    'slashes': true,
    'host': 'www.narwhaljs.org',
    'hostname': 'www.narwhaljs.org',
    'search': '?id=news',
    'query': 'id=news',
    'pathname': '/blog/categories',
    'path': '/blog/categories?id=news'
  },
  'http://mt0.google.com/vt/lyrs=m@114&hl=en&src=api&x=2&y=2&z=3&s=' : {
    'href': 'http://mt0.google.com/vt/lyrs=m@114&hl=en&src=api&x=2&y=2&z=3&s=',
    'protocol': 'http:',
    'slashes': true,
    'host': 'mt0.google.com',
    'hostname': 'mt0.google.com',
    'pathname': '/vt/lyrs=m@114&hl=en&src=api&x=2&y=2&z=3&s=',
    'path': '/vt/lyrs=m@114&hl=en&src=api&x=2&y=2&z=3&s='
  },
  'http://mt0.google.com/vt/lyrs=m@114???&hl=en&src=api&x=2&y=2&z=3&s=' : {
    'href': 'http://mt0.google.com/vt/lyrs=m@114???&hl=en&src=api' +
        '&x=2&y=2&z=3&s=',
    'protocol': 'http:',
    'slashes': true,
    'host': 'mt0.google.com',
    'hostname': 'mt0.google.com',
    'search': '???&hl=en&src=api&x=2&y=2&z=3&s=',
    'query': '??&hl=en&src=api&x=2&y=2&z=3&s=',
    'pathname': '/vt/lyrs=m@114',
    'path': '/vt/lyrs=m@114???&hl=en&src=api&x=2&y=2&z=3&s='
  },
  'http://user:pass@mt0.google.com/vt/lyrs=m@114???&hl=en&src=api&x=2&y=2&z=3&s=': {
    'href': 'http://user:pass@mt0.google.com/vt/lyrs=m@114???' +
        '&hl=en&src=api&x=2&y=2&z=3&s=',
    'protocol': 'http:',
    'slashes': true,
    'host': 'mt0.google.com',
    'auth': 'user:pass',
    'hostname': 'mt0.google.com',
    'search': '???&hl=en&src=api&x=2&y=2&z=3&s=',
    'query': '??&hl=en&src=api&x=2&y=2&z=3&s=',
    'pathname': '/vt/lyrs=m@114',
    'path': '/vt/lyrs=m@114???&hl=en&src=api&x=2&y=2&z=3&s='
  },
  'file:///etc/passwd' : {
    'href': 'file:///etc/passwd',
    'slashes': true,
    'protocol': 'file:',
    'pathname': '/etc/passwd',
    'hostname': '',
    'host': '',
    'path': '/etc/passwd'
  },
  'file://localhost/etc/passwd' : {
    'href': 'file://localhost/etc/passwd',
    'protocol': 'file:',
    'slashes': true,
    'pathname': '/etc/passwd',
    'hostname': 'localhost',
    'host': 'localhost',
    'path': '/etc/passwd'
  },
  'file://foo/etc/passwd' : {
    'href': 'file://foo/etc/passwd',
    'protocol': 'file:',
    'slashes': true,
    'pathname': '/etc/passwd',
    'hostname': 'foo',
    'host': 'foo',
    'path': '/etc/passwd'
  },
  'file:///etc/node/' : {
    'href': 'file:///etc/node/',
    'slashes': true,
    'protocol': 'file:',
    'pathname': '/etc/node/',
    'hostname': '',
    'host': '',
    'path': '/etc/node/'
  },
  'file://localhost/etc/node/' : {
    'href': 'file://localhost/etc/node/',
    'protocol': 'file:',
    'slashes': true,
    'pathname': '/etc/node/',
    'hostname': 'localhost',
    'host': 'localhost',
    'path': '/etc/node/'
  },
  'file://foo/etc/node/' : {
    'href': 'file://foo/etc/node/',
    'protocol': 'file:',
    'slashes': true,
    'pathname': '/etc/node/',
    'hostname': 'foo',
    'host': 'foo',
    'path': '/etc/node/'
  },
  'http:/baz/../foo/bar' : {
    'href': 'http:/baz/../foo/bar',
    'protocol': 'http:',
    'pathname': '/baz/../foo/bar',
    'path': '/baz/../foo/bar'
  },
  'http://user:pass@example.com:8000/foo/bar?baz=quux#frag' : {
    'href': 'http://user:pass@example.com:8000/foo/bar?baz=quux#frag',
    'protocol': 'http:',
    'slashes': true,
    'host': 'example.com:8000',
    'auth': 'user:pass',
    'port': '8000',
    'hostname': 'example.com',
    'hash': '#frag',
    'search': '?baz=quux',
    'query': 'baz=quux',
    'pathname': '/foo/bar',
    'path': '/foo/bar?baz=quux'
  },
  'http:/foo/bar?baz=quux#frag' : {
    'href': 'http:/foo/bar?baz=quux#frag',
    'protocol': 'http:',
    'hash': '#frag',
    'search': '?baz=quux',
    'query': 'baz=quux',
    'pathname': '/foo/bar',
    'path': '/foo/bar?baz=quux'
  },
  'mailto:foo@bar.com?subject=hello' : {
    'href': 'mailto:foo@bar.com?subject=hello',
    'protocol': 'mailto:',
    'host': 'bar.com',
    'auth' : 'foo',
    'hostname' : 'bar.com',
    'search': '?subject=hello',
    'query': 'subject=hello',
    'path': '?subject=hello'
  },
  'xmpp:isaacschlueter@jabber.org' : {
    'href': 'xmpp:isaacschlueter@jabber.org',
    'protocol': 'xmpp:',
    'host': 'jabber.org',
    'auth': 'isaacschlueter',
    'hostname': 'jabber.org'
  },
  'http://atpass:foo%40bar@127.0.0.1:8080/path?search=foo#bar' : {
    'href' : 'http://atpass:foo%40bar@127.0.0.1:8080/path?search=foo#bar',
    'protocol' : 'http:',
    'slashes': true,
    'host' : '127.0.0.1:8080',
    'auth' : 'atpass:foo%40bar',
    'hostname' : '127.0.0.1',
    'port' : '8080',
    'pathname': '/path',
    'search' : '?search=foo',
    'query' : 'search=foo',
    'hash' : '#bar',
    'path': '/path?search=foo'
  },
  'svn+ssh://foo/bar': {
    'href': 'svn+ssh://foo/bar',
    'host': 'foo',
    'hostname': 'foo',
    'protocol': 'svn+ssh:',
    'pathname': '/bar',
    'path': '/bar',
    'slashes': true
  },
  'dash-test://foo/bar': {
    'href': 'dash-test://foo/bar',
    'host': 'foo',
    'hostname': 'foo',
    'protocol': 'dash-test:',
    'pathname': '/bar',
    'path': '/bar',
    'slashes': true
  },
  'dash-test:foo/bar': {
    'href': 'dash-test:foo/bar',
    'host': 'foo',
    'hostname': 'foo',
    'protocol': 'dash-test:',
    'pathname': '/bar',
    'path': '/bar'
  },
  'dot.test://foo/bar': {
    'href': 'dot.test://foo/bar',
    'host': 'foo',
    'hostname': 'foo',
    'protocol': 'dot.test:',
    'pathname': '/bar',
    'path': '/bar',
    'slashes': true
  },
  'dot.test:foo/bar': {
    'href': 'dot.test:foo/bar',
    'host': 'foo',
    'hostname': 'foo',
    'protocol': 'dot.test:',
    'pathname': '/bar',
    'path': '/bar'
  },
  'http://bucket_name.s3.amazonaws.com/image.jpg': {
    'protocol': 'http:',
    'slashes': true,
    'host': 'bucket_name.s3.amazonaws.com',
    'hostname': 'bucket_name.s3.amazonaws.com',
    'pathname': '/image.jpg',
    'href': 'http://bucket_name.s3.amazonaws.com/image.jpg',
    'path': '/image.jpg'
  },
  'git+http://github.com/joyent/node.git': {
    'protocol': 'git+http:',
    'slashes': true,
    'host': 'github.com',
    'hostname': 'github.com',
    'pathname': '/joyent/node.git',
    'path': '/joyent/node.git',
    'href': 'git+http://github.com/joyent/node.git'
  }
};

Object.keys(parseTests).forEach(function(name) {
  exports['test parse ' + name] = function(test) {
    let actual = url.parse(name);
    let expected = parseTests[name];
    Object.keys(expected).forEach(function(key) {
      test.assertEqual(actual[key], expected[key],
                       'proprety ' + key + ' is correct');
    });
  };
});
