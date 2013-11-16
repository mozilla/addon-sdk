/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { get, format } = require("../console/traceback");
const { get: getPref } = require("../preferences/service");
const { wrap, curry, flip } = require("../lang/functional");
const PREFERENCE = "devtools.errorconsole.deprecation_warnings";

function deprecateUsage(msg) {
  // Print caller stacktrace in order to help figuring out which code
  // does use deprecated thing
  let stack = get().slice(2);

  if (getPref(PREFERENCE))
    console.error("DEPRECATED: " + msg + "\n" + format(stack));
}
exports.deprecateUsage = deprecateUsage;

let deprecateFunction = (f, msg) => wrap(f, function(f, ...args) {
  deprecateUsage(msg);
  return f.apply(this, args);
});
exports.deprecateFunction = deprecateFunction;

let deprecateEvent = (f, msg, types) => wrap(f, function(f, ...args) {
  let [type] = args;
  if (types.indexOf(type) >= 0)
    deprecateUsage(msg);

  return f.apply(this, args);
});
exports.deprecateEvent = deprecateEvent;

// Takes deprecation message and function and returns function
// that will print deprecatino warning and then delegate to a
// function. Function is implicitly curried that allows creation
// decorators by just passing first argument.
let deprecated = curry(flip(deprecateFunction));
exports.deprecated = deprecated;
