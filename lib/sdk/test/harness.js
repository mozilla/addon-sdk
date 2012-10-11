/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc,Ci } = require("chrome");
const { Loader } = require('./loader');
const { setTimeout } = require('../timers');
const memory = require('../deprecated/memory');
const { PlainTextConsole } = require("../console/plain-text");
const { when: unload } = require("../system/unload");
const { format }  = require("../console/traceback");
const system = require("../system");

// Trick manifest builder to make it think we need these modules ?
const unit = require("../deprecated/unit-test");
const test = require("../test");
const url = require("../url");

var cService = Cc['@mozilla.org/consoleservice;1'].getService()
               .QueryInterface(Ci.nsIConsoleService);

// Cuddlefish loader in which we load and execute tests.
var loader;

// Function to call when we're done running tests.
var onDone;

// Function to print text to a console, w/o CR at the end.
var print;

// How many more times to run all tests.
var iterationsLeft;

// Whether to report memory profiling information.
var profileMemory;

// Whether we should stop as soon as a test reports a failure.
var stopOnError;

// Function to call to retrieve a list of tests to execute
var findAndRunTests;

// Combined information from all test runs.
var results = {
  passed: 0,
  failed: 0,
  testRuns: []
};

// A list of the compartments and windows loaded after startup
var startLeaks;

// JSON serialization of last memory usage stats; we keep it stringified
// so we don't actually change the memory usage stats (in terms of objects)
// of the JSRuntime we're profiling.
var lastMemoryUsage;

function analyzeRawProfilingData(data) {
  var graph = data.graph;
  var shapes = {};

  // Convert keys in the graph from strings to ints.
  // TODO: Can we get rid of this ridiculousness?
  var newGraph = {};
  for (id in graph) {
    newGraph[parseInt(id)] = graph[id];
  }
  graph = newGraph;

  var modules = 0;
  var moduleIds = [];
  var moduleObjs = {UNKNOWN: 0};
  for (let name in data.namedObjects) {
    moduleObjs[name] = 0;
    moduleIds[data.namedObjects[name]] = name;
    modules++;
  }

  var count = 0;
  for (id in graph) {
    var parent = graph[id].parent;
    while (parent) {
      if (parent in moduleIds) {
        var name = moduleIds[parent];
        moduleObjs[name]++;
        break;
      }
      if (!(parent in graph)) {
        moduleObjs.UNKNOWN++;
        break;
      }
      parent = graph[parent].parent;
    }
    count++;
  }

  print("\nobject count is " + count + " in " + modules + " modules" +
        " (" + data.totalObjectCount + " across entire JS runtime)\n");
  if (lastMemoryUsage) {
    var last = JSON.parse(lastMemoryUsage);
    var diff = {
      moduleObjs: dictDiff(last.moduleObjs, moduleObjs),
      totalObjectClasses: dictDiff(last.totalObjectClasses,
                                   data.totalObjectClasses)
    };

    for (let name in diff.moduleObjs)
      print("  " + diff.moduleObjs[name] + " in " + name + "\n");
    for (let name in diff.totalObjectClasses)
      print("  " + diff.totalObjectClasses[name] + " instances of " +
            name + "\n");
  }
  lastMemoryUsage = JSON.stringify(
    {moduleObjs: moduleObjs,
     totalObjectClasses: data.totalObjectClasses}
  );
}

function dictDiff(last, curr) {
  var diff = {};

  for (let name in last) {
    var result = (curr[name] || 0) - last[name];
    if (result)
      diff[name] = (result > 0 ? "+" : "") + result;
  }
  for (let name in curr) {
    var result = curr[name] - (last[name] || 0);
    if (result)
      diff[name] = (result > 0 ? "+" : "") + result;
  }
  return diff;
}

function reportMemoryUsage() {
  memory.gc();

  var mgr = Cc["@mozilla.org/memory-reporter-manager;1"]
            .getService(Ci.nsIMemoryReporterManager);
  var reporters = mgr.enumerateReporters();
  if (reporters.hasMoreElements())
    print("\n");
  while (reporters.hasMoreElements()) {
    var reporter = reporters.getNext();
    reporter.QueryInterface(Ci.nsIMemoryReporter);
    print(reporter.description + ": " + reporter.memoryUsed + "\n");
  }

  var weakrefs = [info.weakref.get()
                  for each (info in memory.getObjects())];
  weakrefs = [weakref for each (weakref in weakrefs) if (weakref)];
  print("Tracked memory objects in testing sandbox: " +
        weakrefs.length + "\n");
}

var gWeakrefInfo;

function showLeaks() {
  let iterations = 0;

  function checkLeaks() {
    let leaks = getPotentialLeaks();
    let compartmentURLs = Object.keys(leaks.compartments).filter(function(url) {
      return !(url in startLeaks.compartments);
    });

    let windowURLs = Object.keys(leaks.windows).filter(function(url) {
      return !(url in startLeaks.windows);
    });

    if ((iterations < 10) && (compartmentURLs.length || windowURLs.length)) {
      iterations++;
      require("timer").setTimeout(checkLeaks, 100);
      return;
    }

    for (let url of compartmentURLs)
      console.warn("LEAKED", leaks.compartments[url]);

    for (let url of windowURLs)
      console.warn("LEAKED", leaks.windows[url]);

    showResults();
  }

  checkLeaks();
}

function showResults() {
  if (gWeakrefInfo) {
    gWeakrefInfo.forEach(
      function(info) {
        var ref = info.weakref.get();
        if (ref !== null) {
          var data = ref.__url__ ? ref.__url__ : ref;
          var warning = data == "[object Object]"
            ? "[object " + data.constructor.name + "(" +
              [p for (p in data)].join(", ") + ")]"
            : data;
          console.warn("LEAK", warning, info.bin);
        }
      }
    );
  }

  onDone(results);
}

function cleanup() {
  try {
    for (let name in loader.modules)
      memory.track(loader.modules[name],
                           "module global scope: " + name);
      memory.track(loader, "Cuddlefish Loader");

    if (profileMemory) {
      gWeakrefInfo = [{ weakref: info.weakref, bin: info.bin }
                      for each (info in memory.getObjects())];
    }

    loader.unload();

    if (loader.globals.console.errorsLogged && !results.failed) {
      results.failed++;
      console.error("warnings and/or errors were logged.");
    }

    if (consoleListener.errorsLogged && !results.failed) {
      console.warn(consoleListener.errorsLogged + " " +
                   "warnings or errors were logged to the " +
                   "platform's nsIConsoleService, which could " +
                   "be of no consequence; however, they could also " +
                   "be indicative of aberrant behavior.");
    }

    consoleListener.errorsLogged = 0;
    loader = null;

    memory.gc();
  } catch (e) {
    results.failed++;
    console.error("unload.send() threw an exception.");
    console.exception(e);
  };

  setTimeout(showLeaks, 1);
}

function getPotentialLeaks() {
  memory.gc();

  // Things we can assume are part of the platform and so aren't leaks
  let WHITELIST_BASE_URLS = [
    "chrome://",
    "resource:///",
    "resource://app/",
    "resource://gre/",
    "resource://gre-resources/",
    "resource://pdf.js/",
    "resource://pdf.js.components/",
    "resource://services-common/",
    "resource://services-crypto/",
    "resource://services-sync/"
  ];

  let ioService = Cc["@mozilla.org/network/io-service;1"].
                 getService(Ci.nsIIOService);
  let uri = ioService.newURI("chrome://global/content/", "UTF-8", null);
  let chromeReg = Cc["@mozilla.org/chrome/chrome-registry;1"].
                  getService(Ci.nsIChromeRegistry);
  uri = chromeReg.convertChromeURL(uri);
  let spec = uri.spec;
  let pos = spec.indexOf("!/");
  WHITELIST_BASE_URLS.push(spec.substring(0, pos + 2));

  let compartmentRegexp = new RegExp("^explicit/js-non-window/compartments/non-window-global/compartment\\((.+)\\)/");
  let compartmentDetails = new RegExp("^([^,]+)(?:, (.+?))?(?: \\(from: (.*)\\))?$");
  let windowRegexp = new RegExp("^explicit/window-objects/top\\((.*)\\)/active");
  let windowDetails = new RegExp("^(.*), id=.*$");

  function isPossibleLeak(item) {
    if (!item.location)
      return false;

    for (let whitelist of WHITELIST_BASE_URLS) {
      if (item.location.substring(0, whitelist.length) == whitelist)
        return false;
    }

    return true;
  }

  let compartments = {};
  let windows = {};
  function logReporter(process, path, kind, units, amount, description) {
    let matches = compartmentRegexp.exec(path);
    if (matches) {
      if (matches[1] in compartments)
        return;

      let details = compartmentDetails.exec(matches[1]);
      if (!details) {
        console.error("Unable to parse compartment detail " + matches[1]);
        return;
      }
 
      let item = {
        path: matches[1],
        principal: details[1],
        location: details[2] ? details[2].replace("\\", "/", "g") : undefined,
        source: details[3] ? details[3].split(" -> ").reverse() : undefined,
        toString: function() this.location
      };

      if (!isPossibleLeak(item))
        return;

      compartments[matches[1]] = item;
      return;
    }

    matches = windowRegexp.exec(path);
    if (matches) {
      if (matches[1] in windows)
        return;

      let details = windowDetails.exec(matches[1]);
      if (!details) {
        console.error("Unable to parse window detail " + matches[1]);
        return;
      }

      let item = {
        path: matches[1],
        location: details[1].replace("\\", "/", "g"),
        source: [details[1].replace("\\", "/", "g")],
        toString: function() this.location
      };

      if (!isPossibleLeak(item))
        return;

      windows[matches[1]] = item;
    }
  }

  let mgr = Cc["@mozilla.org/memory-reporter-manager;1"].
            getService(Ci.nsIMemoryReporterManager);

  let enm = mgr.enumerateReporters();
  while (enm.hasMoreElements()) {
    let reporter = enm.getNext().QueryInterface(Ci.nsIMemoryReporter);
    logReporter(reporter.process, reporter.path, reporter.kind, reporter.units,
                reporter.amount, reporter.description);
  }

  let enm = mgr.enumerateMultiReporters();
  while (enm.hasMoreElements()) {
    let mr = enm.getNext().QueryInterface(Ci.nsIMemoryMultiReporter);
    mr.collectReports(logReporter, null);
  }

  return { compartments: compartments, windows: windows };
}

function nextIteration(tests) {
  if (tests) {
    results.passed += tests.passed;
    results.failed += tests.failed;

    if (profileMemory)
      reportMemoryUsage();

    let testRun = [];
    for each (let test in tests.testRunSummary) {
      let testCopy = {};
      for (let info in test) {
        testCopy[info] = test[info];
      }
      testRun.push(testCopy);
    }

    results.testRuns.push(testRun);
    iterationsLeft--;
  }

  if (iterationsLeft && (!stopOnError || results.failed == 0)) {
    // Pass the loader which has a hooked console that doesn't dispatch
    // errors to the JS console and avoid firing false alarm in our
    // console listener
    findAndRunTests(loader, nextIteration);
  }
  else {
    setTimeout(cleanup, 0);
  }
}

var POINTLESS_ERRORS = [
  "Invalid chrome URI:",
  "OpenGL LayerManager Initialized Succesfully."
];

var consoleListener = {
  errorsLogged: 0,
  observe: function(object) {
    if (!(object instanceof Ci.nsIScriptError))
      return;
    this.errorsLogged++;
    var message = object.QueryInterface(Ci.nsIConsoleMessage).message;
    var pointless = [err for each (err in POINTLESS_ERRORS)
                         if (message.indexOf(err) == 0)];
    if (pointless.length == 0 && message)
      print("console: " + message + "\n");
  }
};

function TestRunnerConsole(base, options) {
  this.__proto__ = {
    errorsLogged: 0,
    warn: function warn() {
      this.errorsLogged++;
      base.warn.apply(base, arguments);
    },
    error: function error() {
      this.errorsLogged++;
      base.error.apply(base, arguments);
    },
    info: function info(first) {
      if (options.verbose)
        base.info.apply(base, arguments);
      else
        if (first == "pass:")
          print(".");
    },
    __proto__: base
  };
}

var runTests = exports.runTests = function runTests(options) {
  iterationsLeft = options.iterations;
  profileMemory = options.profileMemory;
  stopOnError = options.stopOnError;
  onDone = options.onDone;
  print = options.print;
  findAndRunTests = options.findAndRunTests;

  try {
    cService.registerListener(consoleListener);
    print("Running tests on " + system.name + " " + system.version +
          "/Gecko " + system.platformVersion + " (" +
          system.id + ") under " +
          system.platform + "/" + system.architecture + ".\n");


    loader = Loader(module, {
      console: new TestRunnerConsole(new PlainTextConsole(print), options)
    });

    // Load these before getting initial leak stats as they will still be in
    // memory when we check later
    require("../deprecated/unit-test");
    require("../deprecated/unit-test-finder");
    startLeaks = getPotentialLeaks();

    nextIteration();
  } catch (e) {
    print(format(e) + "\n" + e + "\n");
    onDone({passed: 0, failed: 1});
  }
};

unload(function() {
  cService.unregisterListener(consoleListener);
});

