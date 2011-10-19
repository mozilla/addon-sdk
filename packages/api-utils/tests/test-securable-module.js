const {Cc,Ci,Cu} = require("chrome");

const COMPONENTS_DOT_CLASSES = "Com" + "ponents.classes";

var beetFs = {
  resolveModule: function(root, path) {
    if (path == "beets")
      return path;
  },
  getFile: function(path) {
    return {contents: ('print("hi from ' + path + '");' +
                       ' exports.beets = 5;')};
  }
};

exports.testRunScript = function(test) {
  var output = [];
  function outPrint(msg) { output.push(msg); }
  var SecurableModule = require("securable-module");
  var loader = new SecurableModule.Loader({fs: beetFs,
                                           globals: {print: outPrint},
                                           uriPrefix: "resource://bogus-"});
  var extraOutput = {};
  loader.runScript({contents: 'print("beets is " + ' +
                    'require("beets").beets);'}, extraOutput);
  test.assertEqual(output[0], 'hi from beets', 'module should load');
  test.assertEqual(output[1], 'beets is 5', 'module should export');
  var printSrc = extraOutput.sandbox.getProperty('print');
  if (printSrc == "function outPrint() {\n    [native code]\n}")
    test.pass('extraOutput.sandbox should work');
  else
    test.assertEqual(printSrc,
                     outPrint,
                     'extraOutput.sandbox should work');
};

function FakeCompositeFileSystem(fses) {
  this.fses = fses;
  this._pathMap = {};
};

FakeCompositeFileSystem.prototype = {
  resolveModule: function resolveModule(base, path) {
    for (var i = 0; i < this.fses.length; i++) {
      var fs = this.fses[i];
      var absPath = fs.resolveModule(base, path);
      if (absPath) {
        this._pathMap[absPath] = fs;
        return absPath;
      }
    }
    return null;
  },
  getFile: function getFile(path) {
    return this._pathMap[path].getFile(path);
  }
};

exports.testFakeCompositeFileSystem = function(test) {
  var output = [];
  function outPrint(msg) { output.push(msg); }
  var SecurableModule = require("securable-module");

  var neatFs = {
    resolveModule: function(root, path) {
      if (path == "neat")
        return path;
    },
    getFile: function(path) {
      return {contents: ('require("beets");' +
                         'print("hi from ' + path + '");' +
                         'exports.neat = "yo";')};
    }
  };

  var loader = new SecurableModule.Loader(
    {fs: new FakeCompositeFileSystem([beetFs, neatFs]),
     globals: {print: outPrint},
     uriPrefix: "resource://bogus-"
    });
  output = [];
  loader.runScript({contents: 'print("neat is " + ' +
                    'require("neat").neat);'});
  test.assertEqual(output[0], 'hi from beets',
                 'submodule from composite fs should load');
  test.assertEqual(output[1], 'hi from neat',
                 'module from composite fs should load');
  test.assertEqual(output[2], 'neat is yo',
                 'module from composite fs should export');
};

exports.testAnonymousScriptFilenames = function(test) {
  var SecurableModule = require("securable-module");

  // Ensure parenting of anonymous script filenames works.
  var loader = new SecurableModule.Loader({fs: {},
                                           uriPrefix: "resource://bogus-"});
  try {
    loader.runScript('throw new Error();');
    log("errors must be propogated from content sandboxes", "fail");
  } catch (e) {
    test.assertEqual(e.fileName, '<string>',
                     ('anonymous scripts w/o chrome privs should be ' +
                      'unparented'));
  }
};

exports.testSystemPrincipal = function(test) {
  var SecurableModule = require("securable-module");
  var loader = new SecurableModule.Loader({fs: {},
                                           defaultPrincipal: "system",
                                           uriPrefix: "resource://bogus-"});
  try {
    loader.runScript('throw new Error();');
    log("errors must be propogated from chrome sandboxes", "fail");
  } catch (e) {
    test.assertEqual(e.fileName.slice(-11), '-> <string>',
                   ('anonymous scripts w/ chrome privs should be ' +
                    'parented'));
  }
};

exports.testNonExistentModule = function(test) {
  var SecurableModule = require("securable-module");

  // Ensure loading nonexistent modules raises an error.
  var loader = new SecurableModule.Loader(
    {fs: {
       resolveModule: function() { return null; },
       getFile: function(path) {
         throw new Error('I should never get called.');
       }
     },
     uriPrefix: "resource://bogus-"
    });
  try {
    loader.runScript({contents: 'require("foo");'});
    log("loading of nonexistent module did not raise exception",
        "fail");
  } catch (e) {
    test.assertEqual(e.message, 'Module "foo" not found',
                   'loading of nonexistent module should raise error');
  }
};

exports.testNoChrome = function(test) {
  var SecurableModule = require("securable-module");
  var loader = new SecurableModule.Loader({fs: {},
                                           uriPrefix: "resource://bogus-"});
  try {
    loader.runScript({contents: COMPONENTS_DOT_CLASSES});
    log("modules shouldn't have chrome privileges by default.",
        "fail");
  } catch (e) {
    // The error message that gets thrown is localized, so we must compare
    // it to the localized version.  This should be as simple as retrieving
    // that version from its string bundle, but the error message is also
    // corrupted (its characters' high bytes thrown away due to bug 567597),
    // so we have to do the same to the version to which we compare it.
    let bundle =
      require("app-strings").
      StringBundle("chrome://global/locale/security/caps.properties");
    let message = bundle.get("GetPropertyDeniedOriginsOnlySubject",
                             ["http://www.mozilla.org", "XPCComponents",
                              "classes"]).
      split("").
      map(function(v) v.charCodeAt(0)).
      map(function(v) v % 256).
      map(function(v) String.fromCharCode(v)).
      join("");

    test.assertEqual(e.message, message,
                   "modules shouldn't have chrome privileges by default.");
  }
};

exports.testYesChrome = function(test) {
  var SecurableModule = require("securable-module");
  var loader = new SecurableModule.Loader(
    {fs: {},
     defaultPrincipal: "system",
     uriPrefix: "resource://bogus-"
    });
  loader.runScript({contents: COMPONENTS_DOT_CLASSES});
  test.pass("modules should be able to have chrome privileges.");
};

var url = require("url");
var path = url.URL("interoperablejs-read-only/compliance/",
                   __url__).toString();
path = url.toFilename(path);

var ios = Cc['@mozilla.org/network/io-service;1']
  .getService(Ci.nsIIOService);

var rootDir = Cc['@mozilla.org/file/local;1']
  .createInstance(Ci.nsILocalFile);
rootDir.initWithPath(path);

exports.testInferRootDirectory = function(test) {
  var SecurableModule = require("securable-module");

  // Test the way LocalFileSystem infers root directories.
  var fs = new SecurableModule.LocalFileSystem(rootDir);
  test.assertEqual(fs._rootURIDir, ios.newFileURI(rootDir).spec,
                 "fs rootdir should be same as passed-in dir");

  var someFile = rootDir.clone();
  someFile.append("ORACLE");
  fs = new SecurableModule.LocalFileSystem(someFile);
  test.assertEqual(fs._rootURIDir, ios.newFileURI(rootDir).spec,
                 "fs rootdir sould be dirname of file");

  someFile = rootDir.clone();
  someFile.append("monkeys");
  fs = new SecurableModule.LocalFileSystem(someFile);
  test.assertEqual(fs._rootURIDir, ios.newFileURI(someFile).spec,
                 "fs rootdir should be same as passed-in subdir");

  if (SecurableModule.baseURI) {
    // Note that a '/' must be put after the directory name.
    var newURI = ios.newURI('lib/', null, SecurableModule.baseURI);
    fs = new SecurableModule.LocalFileSystem(newURI);
    test.assertEqual(fs._rootURIDir, newURI.spec,
                   "fs rootdir should be subdir of document's dir");

    loader = new SecurableModule.Loader();
    test.assertEqual(loader._fs._rootURI.spec, SecurableModule.baseURI.spec,
                   "fs rootdir should be document's dir");
  } else {
    try {
      loader = new SecurableModule.Loader();
      test.fail("Loader() w/ no params in a non-document context should " +
                "raise an exception.");
    } catch (e if e.message == "Need a root path for module filesystem") {
      test.pass("Loader() w/ no params in a non-document context should " +
                "raise an exception.");
    }
  }
};

exports.testCallbackStyle = function(test) {
  // Confirm callback-based require works from an instantiated loader.
  // want to be back in api-utils/tests directory instead of
  // what rootDir is now:
  // api-utils/tests/interoperablejs-read-only/compliance/
  var SecurableModule = require("securable-module");
  var moduleDir = rootDir.parent.parent;
  moduleDir.append("modules");
  var loader = new SecurableModule.Loader(
    {rootPath: moduleDir,
     defaultPrincipal: "system",
     uriPrefix: "resource://bogus-"
    });

  loader.require(["subtract"], function (subtract) {
                   test.assertEqual(2, subtract(3, 1),
                                    "subtract module works with callback-style require");
                 });
};



exports.testCompliance = function(test) {
  // The tests in this file weren't originally written for
  // Cuddlefish. This function is essentially an adapter
  // that runs the tests using the Cuddlefish testing
  // framework.
  var SecurableModule = require("securable-module");
  function log(msg, type) {
    switch (type) {
    case "fail":
      test.fail(msg);
      break;
    case "pass":
      test.pass(msg);
      break;
    case "info":
      console.info(msg);
    }
  }

  // Run all CommonJS SecurableModule compliance tests.
  if (false)
    require("./interoperablejs-read-only/all"); // add to manifest

  var loader = test.makeSandboxedLoader(require("packaging").myURI,
                                        {rootPath: rootDir,
                                         defaultPrincipal: "system",
                                         globals: {sys: {print: log}},
                                         uriPrefix: "resource://bogus-"
                                        });
  loader.require("./interoperablejs-read-only/all");

};

exports.testFindSandboxForModule = function(test) {
  var fs = {
    resolveModule: function(base, path) {
      test.assertEqual(base, null);
      test.assertEqual(path, "foo");
      return "/blarg/foo";
    },
    getFile: function(path) {
      test.assertEqual(path, "/blarg/foo");
      return {contents: "var baz = 1;"};
    }
  };

  var sm = require("securable-module");
  var loader = new sm.Loader({fs: fs});
  var sandbox = loader.findSandboxForModule("foo");
  test.assertEqual(sandbox.globalScope.baz, 1);
};

exports.testUtf8 = function (test) {
  // This test ensures that the securable module loader assumes files are
  // UTF-8-encoded and therefore decodes them properly when it reads them.
  var str = "文字";

  // Read this file into readStr, decoding from UTF-8.
  var filename = require("url").toFilename(__url__);
  var readStr = require("file").read(filename);

  // If str is not in readStr, then str and therefore this file were not decoded
  // from UTF-8 by the loader.
  test.assert(readStr.indexOf(str) >= 0, "Loader should treat files as UTF-8");
};

exports.testGetModuleExports = function (test) {
  var sm = require("securable-module");

  function myGetModuleExports(basePath, module) {
    if (module == "foo")
      return {bar: 1};
    return null;
  }

  var loader = new sm.Loader({getModuleExports: myGetModuleExports,
                              fs: beetFs,
                              globals: {print: function() {}}});

  test.assertEqual(loader.require("foo").bar, 1,
                   "getModuleExports() works");
  test.assertEqual(loader.require("beets").beets, 5,
                   "loader falls through to fs when getModuleExports() " +
                   "returns null");
};

exports.testModifyModuleSandbox = function (test) {
  var sm = require("securable-module");
  var out;

  function modifyModuleSandbox(sandbox, options) {
    sandbox.defineProperty("print", function() { out = options.contents; });
  }

  var loader = new sm.Loader({modifyModuleSandbox: modifyModuleSandbox,
                              globals: {print: function() {}},
                              fs: beetFs});

  loader.require("beets");
  test.assertEqual(out,
                   "print(\"hi from beets\"); exports.beets = 5;",
                   "testModifyModuleSandbox() mods override globals");
};
