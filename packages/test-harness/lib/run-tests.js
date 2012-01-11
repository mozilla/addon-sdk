/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var obsvc = require("api-utils/observer-service");
var system = require("api-utils/system");
var options = require('@packaging');
var {Cc,Ci} = require("chrome");

function runTests(iterations, filter, profileMemory, stopOnError, verbose, exit, print) {
  var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
           .getService(Ci.nsIWindowWatcher);

  let ns = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
  let msg = 'Running tests...';
  let markup = '<?xml version="1.0"?><window xmlns="' + ns +
               '" windowtype="test:runner"><label>' + msg + '</label></window>';
  let url = "data:application/vnd.mozilla.xul+xml," + escape(markup);


  var window = ww.openWindow(null, url, "harness", "centerscreen", null);

  var harness = require("./harness");

  function onDone(tests) {
    window.close();
    if (tests.failed == 0) {
      if (tests.passed === 0)
        print("No tests were run\n");
      exit(0);
    } else {
      printFailedTests(tests, verbose, print);
      exit(1);
    }
  };

  // We have to wait for this window to be fully loaded *and* focused
  // in order to avoid it to mess with our various window/focus tests.
  // We are first waiting for our window to be fully loaded before ensuring
  // that it will take the focus, and then we wait for it to be focused.
  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    window.addEventListener("focus", function onfocus() {
      window.removeEventListener("focus", onfocus, true);
      // Finally, we have to run test on next cycle, otherwise XPCOM components
      // are not correctly updated.
      // For ex: nsIFocusManager.getFocusedElementForWindow may throw
      // NS_ERROR_ILLEGAL_VALUE exception.
      require("timer").setTimeout(function () {
        harness.runTests({iterations: iterations,
                          filter: filter,
                          profileMemory: profileMemory,
                          stopOnError: stopOnError,
                          verbose: verbose,
                          print: print,
                          onDone: onDone});
      }, 0);
    }, true);
    window.focus();
  }, true);
}

function printFailedTests(tests, verbose, print) {
  if (!verbose)
    return;

  let iterationNumber = 0;
  let singleIteration = tests.testRuns.length == 1;
  let padding = singleIteration ? "" : "  ";

  print("\nThe following tests failed:\n");

  for each (let testRun in tests.testRuns) {
    iterationNumber++;

    if (!singleIteration)
      print("  Iteration " + iterationNumber + ":\n"); 

    for each (let test in testRun) {
      if (test.failed > 0) {
        print(padding + "  " + test.name + ": " + test.errors +"\n");
      }
    }
    print("\n");
  }
}

exports.main = function main() {
  var testsStarted = false;

  if (!testsStarted) {
    testsStarted = true;
    runTests(options.iterations, options.filter,
             options.profileMemory, options.stopOnError, options.verbose,
             system.exit,
             dump);
  }
};
