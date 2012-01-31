/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var { setTimeout } = require("../timer");

/**
 * Takes a function and returns a wrapped one instead, calling which will call
 * original function in the next turn of event loop. This is basically utility
 * to do `setTimeout(function() { ... }, 0)`, with a difference that returned
 * function is reused, instead of creating a new one each time. This also allows
 * to use this functions as event listeners.
 */
function Enqueued(callee) {
  return function enqueued()
    setTimeout(invoke, 0, callee, arguments, this);
}
exports.Enqueued = Enqueued;

/**
 * Invokes `callee` by passing `params` as an arguments and `self` as `this`
 * pseudo-variable. Returns value that is returned by a callee.
 * @param {Function} callee
 *    Function to invoke.
 * @param {Array} params
 *    Arguments to invoke function with.
 * @param {Object} self
 *    Object to be passed as a `this` pseudo variable.
 */
function invoke(callee, params, self) callee.apply(self, params);
exports.invoke = invoke;

/**
 * Curries a function with the arguments given.
 *
 * @param {Function} fn
 *    The function to curry
 *
 * @returns The function curried
 */
function curry(fn) {
  if (typeof fn !== "function")
    throw new TypeError(String(fn) + " is not a function");

  let args = Array.slice(arguments, 1);

  return function() fn.apply(this, args.concat(Array.slice(arguments)));
}
exports.curry = curry;
