/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Returns promise that resolves to a given `value`.
 */
function resolution(value) {
  return { then: function then(resolve) { resolve(value); } };
}

/**
 * Returns promise that rejects with a given `reason`.
 */ 
function rejection(reason) {
  return { then: function then(resolve, reject) { reject(reason); } };
}

/**
 * Returns function that delegates to `f`. If `f` throws then captures
 * error and returns promise that rejects with a thrown error.
 */
function attempt(f) {
  return function attempt(options) { 
    try {
      return f(options);
    }
    catch(error) {
      return rejection(error);
    }
  };
}

/**
 * Returns true if given `value` is promise. Value is assumed to be promise if
 * it implements `then` method.
 */
function isPromise(value) {
  return value && typeof(value.then) === 'function';
}
exports.isPromise = isPromise;


/**
  Returns object containing following properties:
  - `promise` Eventual value representation implementing CommonJS [Promises/A]
    (http://wiki.commonjs.org/wiki/Promises/A) API.
  - `resolve` Single shot function that resolves returned `promise` with a given
    `value` argument.
  - `reject` Single shot function that rejects returned `promise` with a given
    `reason` argument.

  Given `prototype` argument is used as a prototype of the returned `promise`
  allowing one to implement additional API. If prototype is not passed then
  it falls back to `Object.prototype`.
*/
function defer(prototype) {
  let pending = [], result;
  prototype = prototype === undefined ? Object.prototype : prototype;

  // Create an object implementing promise API.
  let promise = Object.create(prototype, {
    then: { value: function then(resolve, reject) {
      // create a new deferred using a same `prototype`.
      let deferred = defer(prototype);
      // If `resolve / reject` callbacks are not provided.
      resolve = resolve ? attempt(resolve) : resolution;
      reject = reject ? attempt(reject) : rejection;

      // Create a listeners for a enclosed promise resolution / rejection that
      // delegate to an actual callbacks and resolve / reject returned promise.
      function resolved(value) { deferred.resolve(resolve(value)); }
      function rejected(reason) { deferred.resolve(reject(reason)); }

      // If promise is pending register listeners. Otherwise forward them to
      // resulting resolution.
      if (pending) pending.push([ resolved, rejected ]);
      else result.then(resolved, rejected);

      return deferred.promise;
    }}
  });

  let deferred = {
    promise: promise,
    /**
     * Resolves associated `promise` to a given `value`, unless it's already
     * resolved or rejected.
     */
    resolve: function resolve(value) {
      if (pending) {
        // store resolution `value` as a promise (`value` itself may be a
        // promise), so that all subsequent listeners can be forwarded to it,
        // which either resolves immediately or forwards if `value` is
        // a promise.
        result = isPromise(value) ? value : resolution(value);
        // forward all pending observers.
        pending.forEach(function onEach([ resolve, reject ]) {
          result.then(resolve, reject);
        });
        // mark promise as resolved.
        pending = null;
      }
    },
    /**
     * Rejects associated `promise` with a given `reason`, unless it's already
     * resolved / rejected.
     */
    reject: function reject(reason) {
      deferred.resolve(rejection(reason));
    }
  };

  return deferred;
}
exports.defer = defer;

/**
 * Returns a promise that rejects with a given `reason`.
 */
function failure(reason) {
  let { promise, reject } = defer();
  reject(reason);
  return promise;
}
exports.failure = failure;

/**
 * Returns a promise that resolves to a given `value`.
 */
function promise(value) {
  let { promise, resolve } = defer();
  resolve(value);
  return promise;
}
exports.promise = promise;

/**
 * Returned a promise that immediately resolves to `task(options)` or
 * rejects on exception.
 */
function future(task, options) {
  return promise(options).then(task);
}
/**
 * Returned a promise that resolves to `task(options)` or
 * rejects on exception, but unlike `future` does this on demand.
 */
future.lazy = function lazyfuture(task, options) {
  let result
  return { then: function then(resolve, reject) {
    result = result || future(task, options);
    return result.then(resolve, reject);
  }};
};
exports.future = future;
