/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

var obsvc = require("api-utils/observer-service");
var system = require("api-utils/system");
var options = require('@packaging');
var {Cc,Ci} = require("chrome");

function runTests(iterations, filter, profileMemory, verbose, exit, print) {
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
             options.profileMemory, options.verbose,
             system.exit,
             dump);
  }
};
