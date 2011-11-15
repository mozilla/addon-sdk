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

const file = require("./file");
const packaging = require('@packaging');
const suites = packaging.allTestModules;

const NOT_TESTS = ['setup', 'teardown'];

var TestFinder = exports.TestFinder = function TestFinder(options) {
  memory.track(this);
  this.filter = options.filter;
  this.testInProcess = options.testInProcess === false ? false : true;
  this.testOutOfProcess = options.testOutOfProcess === true ? true : false;
};

TestFinder.prototype = {
  _makeTest: function _makeTest(suite, name, test) {
    function runTest(runner) {
      console.info("executing '" + suite + "." + name + "'");
      test(runner);
    }
    return runTest;
  },

  findTests: function findTests(cb) {
    var self = this;
    var tests = [];
    var filter;
    // A filter string is {fileNameRegex}[:{testNameRegex}] - ie, a colon
    // optionally separates a regex for the test fileName from a regex for the
    // testName.
    if (this.filter) {
      var colonPos = this.filter.indexOf(':');
      var filterFileRegex, filterNameRegex;
      if (colonPos === -1) {
        filterFileRegex = new RegExp(self.filter);
      } else {
        filterFileRegex = new RegExp(self.filter.substr(0, colonPos));
        filterNameRegex = new RegExp(self.filter.substr(colonPos + 1));
      }
      // This function will first be called with just the filename; if
      // it returns true the module will be loaded then the function
      // called again with both the filename and the testname.
      filter = function(filename, testname) {
        return filterFileRegex.test(filename) &&
               ((testname && filterNameRegex) ? filterNameRegex.test(testname)
                                              : true);
      };
    } else
      filter = function() {return true};

    suites.forEach(
      function(suite) {
        var module = require(suite);
        if (self.testInProcess)
          for each (let name in Object.keys(module).sort()) {
            if(NOT_TESTS.indexOf(name) === -1 && filter(suite, name)) {
              tests.push({
                           setup: module.setup,
                           teardown: module.teardown,
                           testFunction: self._makeTest(suite, name, module[name]),
                           name: suite + "." + name
                         });
            }
          }
      });

    cb(tests);
  }
};
