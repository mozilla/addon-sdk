/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Disclaimer: Some of the functions in this module implement APIs from
// Jeremy Ashkenas's http://underscorejs.org/ library and all credits for
// those goes to him.

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { setImmediate, setTimeout } = require("../timers");

let arity = f => f.arity || f.length;
exports.arity = arity;

let name = f => f.displayName || f.name;
exports.name = name;

let derive = (f, source) => {
  f.displayName = name(source);
  f.arity = arity(source);
  return f;
}
exports.derive = derive;

/**
 * Takes variadic numeber of functions and returns composed one.
 * Returned function pushes `this` pseudo-variable to the head
 * of the passed arguments and invokes all the functions from
 * left to right passing same arguments to them. Composite function
 * returns return value of the right most funciton.
 */
let method = (...lambdas) => {
  return function method(...args) {
    args.unshift(this)
    return lambdas.reduce((_, lambda) => lambda.apply(this, args),
                          void(0));
  }
}
exports.method = method;

/**
 * Takes a function and returns a wrapped one instead, calling which will call
 * original function in the next turn of event loop. This is basically utility
 * to do `setImmediate(function() { ... })`, with a difference that returned
 * function is reused, instead of creating a new one each time. This also allows
 * to use this functions as event listeners.
 */
let defer = f => derive(function(...args) {
  setImmediate(invoke, f, args, this)
}, f);
exports.defer = defer;
// Exporting `remit` alias as `defer` may conflict with promises.
exports.remit = defer;

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
 * Takes a function and bind values to one or more arguments, returning a new
 * function of smaller arity.
 *
 * @param {Function} fn
 *    The function to partial
 *
 * @returns The new function with binded values
 */
function partial(f, ...curried) {
  if (typeof(f) !== "function")
    throw new TypeError(String(f) + " is not a function");

  let fn = derive(function(...args) f.apply(this, curried.concat(args)), f);
  fn.arity = arity(f) - curried.length;
  return fn;
}
exports.partial = partial;

/**
 * Returns function with implicit currying, which will continue currying until
 * expected number of argument is collected. Expected number of arguments is
 * determined by `fn.length`. Using this with variadic functions is stupid,
 * so don't do it.
 *
 * @examples
 *
 * var sum = curry(function(a, b) {
 *   return a + b
 * })
 * console.log(sum(2, 2)) // 4
 * console.log(sum(2)(4)) // 6
 */
var curry = new function() {
  function currier(fn, arity, params) {
    // Function either continues to curry arguments or executes function
    // if desired arguments have being collected.
    return function curried() {
      var input = Array.slice(arguments);
      // Prepend all curried arguments to the given arguments.
      if (params) input.unshift.apply(input, params);
      // If expected number of arguments has being collected invoke fn,
      // othrewise return curried version Otherwise continue curried.
      return (input.length >= arity) ? fn.apply(this, input) :
             currier(fn, arity, input);
    };
  }

  return function curry(fn) {
    return currier(fn, arity(fn));
  }
};
exports.curry = curry;

/**
 * Returns the composition of a list of functions, where each function consumes
 * the return value of the function that follows. In math terms, composing the
 * functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
 * @example
 *
 *   var greet = function(name) { return "hi: " + name; };
 *   var exclaim = function(statement) { return statement + "!"; };
 *   var welcome = compose(exclaim, greet);
 *
 *   welcome('moe');    // => 'hi: moe!'
 */
function compose(...lambdas) {
  return function composed(...args) {
    let index = lambdas.length;
    while (0 <= --index)
      args = [ lambdas[index].apply(this, args) ];

    return args[0];
  };
}
exports.compose = compose;

/*
 * Returns the first function passed as an argument to the second,
 * allowing you to adjust arguments, run code before and after, and
 * conditionally execute the original function.
 * @example
 *
 *  var hello = function(name) { return "hello: " + name; };
 *  hello = wrap(hello, function(f) {
 *    return "before, " + f("moe") + ", after";
 *  });
 *
 *  hello();    // => 'before, hello: moe, after'
 */
let wrap = (f, wrapper) => derive(function wrapped(...args) {
  return wrapper.apply(this, [f].concat(args));
}, f);
exports.wrap = wrap;

/**
 * Returns the same value that is used as the argument. In math: f(x) = x
 */
function identity(value) value
exports.identity = identity;

/**
 * Memoizes a given function by caching the computed result. Useful for
 * speeding up slow-running computations. If passed an optional hashFunction,
 * it will be used to compute the hash key for storing the result, based on
 * the arguments to the original function. The default hashFunction just uses
 * the first argument to the memoized function as the key.
 */
function memoize(f, hasher) {
  let memo = Object.create(null);
  let cache = new WeakMap();
  hasher = hasher || identity;
  return derive(function memoizer() {
    let key = hasher.apply(this, arguments);
    let type = typeof(key);
    if (key && (type === "object" || type === "function")) {
      if (!cache.has(key)) cache.set(key, f.apply(this, arguments));
      return cache.get(key);
    }
    else {
      if (!(key in memo)) memo[key] = f.apply(this, arguments);
      return memo[key];
    }
  }, f);
}
exports.memoize = memoize;

/**
 * Much like setTimeout, invokes function after wait milliseconds. If you pass
 * the optional arguments, they will be forwarded on to the function when it is
 * invoked.
 */
function delay(f, ms, ...args)
  setTimeout(() => f.apply(this, args), ms);
exports.delay = delay;

/**
 * Creates a version of the function that can only be called one time. Repeated
 * calls to the modified function will have no effect, returning the value from
 * the original call. Useful for initialization functions, instead of having to
 * set a boolean flag and then check it later.
 */
function once(f) {
  let ran = false, cache;
  return derive(function(...args) {
    return ran ? cache : (ran = true, cache = f.apply(this, args))
  }, f);
};
exports.once = once;
// export cache as once will may be conflicting with event once a lot.
exports.cache = once;

// Takes a `f` function and returns a function that takes the same
// arguments as `f`, has the same effects, if any, and returns the
// opposite truth value.
let complement = f => derive(function(...args) !f.apply(this, args), f);
exports.complement = complement;

// Constructs function that returns `x` no matter what is it
// invoked with.
let constant = x => _ => x;
exports.constant = constant;

// Takes `p` predicate, `consequent` function and an optional
// `alternate` function and composes function that returns
// application of arguments over `consequent` if application over
// `p` is `true` otherwise returns application over `alternate`.
// If `alternate` is not a function returns `undefined`.
let when = (p, consequent, alternate) => {
  if (typeof(alternate) !== "function" && alternate !== void(0))
    throw Error("alternate must be a function");
  if (typeof(consequent) !== "function")
    throw Error("consequent must be a function");

  return function(...args) {
    return p.apply(this, args) ?
           consequent.apply(this, args) :
           alternate && alternate.apply(this, args);
  }
}
exports.when = when;

// Apply function that behaves as `apply` does in lisp:
// apply(f, x, [y, z]) => f.apply(f, [x, y, z])
// apply(f, x) => f.apply(f, [x])
let apply = (f, ...rest) => f.apply(f, rest.concat(rest.pop()));
exports.apply = apply;

// Returns function identical to given `f` but with flipped order
// of arguments.
let flip = f => derive(function(...args) f.apply(this, args.reverse()), f);
exports.flip = flip;
