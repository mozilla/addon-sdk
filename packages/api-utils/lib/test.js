/* vim:ts=2:sts=2:sw=2:
 * ***** BEGIN LICENSE BLOCK *****
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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

const BaseAssert = require("./test/assert").Assert;
const { isFunction, isObject } = require("type");

/**
 * Function takes test `suite` object in CommonJS format and defines all of the
 * tests from that suite and nested suites in a jetpack format on a given
 * `target` object. Optionally third argument `prefix` can be passed to prefix
 * all the test names.
 */
function defineTestSuite(target, suite, prefix) {
  prefix = prefix || "";
  // If suite defines `Assert` that's what `assert` object have to be created
  // from and passed to a test function (This allows custom assertion functions)
  // See for details: http://wiki.commonjs.org/wiki/Unit_Testing/1.1
  let Assert = suite.Assert || BaseAssert;
  // Going through each item in the test suite and wrapping it into a
  // Jetpack test format.
  Object.keys(suite).forEach(function(key) {
     // If name starts with test then it's a test function or suite.
    if (key.indexOf("test") === 0) {
      let test = suite[key];

      // For each test function so we create a wrapper test function in a
      // jetpack format and copy that to a `target` exports.
      if (isFunction(test)) {

        // Since names of the test may match across suites we use full object
        // path as a name to avoid overriding same function.
        target[prefix + key] = function(options) {

          // Creating `assert` functions for this test.
          let assert = Assert(options);

          // If CommonJS test function expects more than one argument
          // it means that test is async and second argument is a callback
          // to notify that test is finished.
          if (1 < test.length) {

            // Letting test runner know that test is executed async and
            // creating a callback function that CommonJS tests will call
            // once it's done.
            options.waitUntilDone();
            test(assert, function() {
              options.done();
            });
          }

          // Otherwise CommonJS test is synchronous so we call it only with
          // one argument.
          else {
            test(assert);
          }
        }
      }

      // If it's an object then it's a test suite containing test function
      // and / or nested test suites. In that case we just extend prefix used
      // and call this function to copy and wrap tests from nested suite.
      else if (isObject(test)) {
        test.Assert = test.Assert || Assert;
        defineTestSuite(target, test, prefix + key + ".");
      }
    }
  });
}

/**
 * This function is a CommonJS test runner function, but since Jetpack test
 * runner and test format is different from CommonJS this function shims given
 * `exports` with all its tests into a Jetpack test format so that the built-in
 * test runner will be able to run CommonJS test without manual changes.
 */
exports.run = function run(exports) {

  // We can't leave old properties on exports since those are test in a CommonJS
  // format that why we move everything to a new `suite` object.
  let suite = {};
  Object.keys(exports).forEach(function(key) {
    suite[key] = exports[key];
    delete exports[key];
  });

  // Now we wrap all the CommonJS tests to a Jetpack format and define
  // those to a given `exports` object since that where jetpack test runner
  // will look for them.
  defineTestSuite(exports, suite);
};
