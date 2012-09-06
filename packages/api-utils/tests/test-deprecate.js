/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const deprecate = require("deprecate");
var { Loader } = require("test-harness/loader");

function LoaderWithHookedConsole() {
  let errors = [];
  let loader = Loader(module, {
    console: Object.create(console, {
      error: { value: function(error) {
        errors.push(error);
      }}
    })
  });

  return {
    loader: loader,
    deprecate: loader.require("api-utils/deprecate"),
    errors: errors
  }
}

exports.testDeprecatedUsage = function testDeprecatedUsage(test) {
  let { loader, deprecate, errors } = LoaderWithHookedConsole();
  deprecate.deprecatedUsage("foo");

  test.assertEqual(errors.length, 1,
                   "only one error is dispatched");
  let msg = errors[0];
  test.assert(msg.indexOf("foo") !== -1, "message contains the given message");
  test.assert(msg.indexOf("testDeprecatedUsage") !== -1,
              "message contains name of the caller function");
  test.assert(msg.indexOf(module.uri) !== -1,
              "message contains URI of the caller module");
  loader.unload();
}

exports.testDeprecateFunction = function testDeprecateFunction(test) {
  let { loader, deprecate, errors } = LoaderWithHookedConsole();

  let self = {};
  let arg1 = "foo";
  let arg2 = {};
  function originalFunction(a1, a2) {
    test.assertEqual(this, self);
    test.assertEqual(a1, arg1);
    test.assertEqual(a2, arg2);
  };
  let deprecatedFunction = deprecate.deprecateFunction(originalFunction,
                                                       "bar");

  deprecatedFunction.call(self, arg1, arg2);

  test.assertEqual(errors.length, 1,
                   "only one error is dispatched");
  let msg = errors[0];
  test.assert(msg.indexOf("bar") !== -1, "message contains the given message");
  test.assert(msg.indexOf("testDeprecateFunction") !== -1,
              "message contains name of the caller function");
  test.assert(msg.indexOf(module.uri) !== -1,
              "message contains URI of the caller module");
  loader.unload();
}
