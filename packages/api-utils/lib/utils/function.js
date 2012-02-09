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
function defer(f) {
  return function deferred()
    setTimeout(invoke, 0, f, arguments, this);
}
exports.defer = defer;
exports.Enqueued = function Enqueued() {
  console.warn('Function was renamed to `defer` please use it instead.')
  return defer.apply(this, arguments);
};

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
 * Takes `lambda` function and returns a method. When returned method is
 * invoked it calls wrapped `lambda` and passes `this` as a first argument
 * and given argument as rest.
 */
function method(lambda) {
  return function method() {
    return lambda.apply(null, [this].concat(Array.slice(arguments)));
  }
}
exports.method = method;

function curry(lambda) {
  let rest = Array.slice(arguments, 1);
  return function curried() {
    return lambda.apply(this, rest.concat(Array.slice(arguments)));
  };
}
exports.curry = curry;

/**
* Returns the composition of a list of functions, where each function consumes
* the return value of the function that follows. In math terms, composing the
* functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
* @exmple
* var greet = function(name){ return "hi: " + name; };
* var exclaim = function(statement){ return statement + "!"; };
* var welcome = _.compose(exclaim, greet);
* welcome('moe');
* //> 'hi: moe!'
*/
function compose() {
  var lambdas = Array.slice(arguments);
  return function composed() {
    var args = Array.slice(arguments), index = lambdas.length;
    while (0 <= --index)
      args = [ lambdas[index].apply(this, args) ];
    return args[0];
  };
}
exports.compose = compose;
