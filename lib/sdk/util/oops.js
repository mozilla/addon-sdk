/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { curry, derive, complement } = require("../lang/functional");

// Takes field `name` and `target` and returns value of that field.
// If `target` is `null` or `undefined` it would be returned back
// instead of attempt to access it's field. Function is implicitly
// curried, this allows accessor function generation by calling it
// with only `name` argument.
let field = curry((name, target) =>
                    // Note: Permisive `==` is intentional.
                    target == null ? target : target[name]);
exports.field = field;

// Takes `.` delimited string representing `path` to a nested field
// and a `target` to get it from. For convinience function is
// implicitly curried, there for accessors can be created by invoking
// it with just a `path` argument.
let query = curry((path, target) => {
  let names = path.split(".");
  let count = names.length;
  let index = 0;
  let result = target;
  // Note: Permisive `!=` is intentional.
  while (result != null && index < count) {
    result = result[names[index]];
    index = index + 1;
  }
  return result;
});
exports.query = query;

// Takes `Type` (constructor function) and a `value` and returns
// `true` if `value` is instance of the given `Type`. Function is
// implicitly curried this allows predicate generation by calling
// function with just first argument.
let isInstance = curry((Type, value) => value instanceof Type);
exports.isInstance = isInstance;

/*
 * Takes a funtion and returns a wrapped function that returns `this`
 */
let chainable = f => derive(function(...args) (f.apply(this, args), this), f);
exports.chainable = chainable;

// Functions takes `expected` and `actual` values and returns `true` if
// `expected === actual`. Returns curried function if called with less then
// two arguments.
//
// [ 1, 0, 1, 0, 1 ].map(is(1)) // => [ true, false, true, false, true ]
let is = curry((expected, actual) => actual === expected);
exports.is = is;

let isnt = complement(is);
exports.isnt = isnt;
