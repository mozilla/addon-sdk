/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: true latedef: false supernew: true */
/*global define: true */
(function(factory) {
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(exports) === 'object') { // CommonJS
    factory(require, exports);
  } else if (String(this).indexOf('BackstagePass') != -1) { // JSM
    factory(undefined, this);
    this.EXPORTED_SYMBOLS = Object.keys(this);
  } else {
    factory(undefined, (this.promise = {}));
  }
})(function(require, exports) {

'use strict';

// Utility function: execute |f(value)|, transmit
// success to |promise.resolve| or failure to
// |promise.reject|.
function box(f, value, promise) {
  var result;
  try {
    result = f(value);
  } catch (x) {
    promise.reject(x);
    return;
  }
  promise.resolve(value);
};

// Utility function: if |isResolve|, execute |onResolve(value)|,
// otherwise execute |onReject(value)|, transmit success/failures
// to |promise.resolve|/|promise.reject|. If |onResolve|/|onReject|
// does not exist, simply resolve/reject |promise|.
function box2(onResolve, onReject, isResolve, value, promise) {
  if (isResolve) {
    if (onResolve) {
      box(onResolve, value, next);
    } else {
      next.resolve(value);
    }
  } else {
    if (onReject) {
      box(onReject, value, next);
    } else {
      next.reject(value);
    }
}

var propagate = function propagate(state, isResolve, value) {
  var observerCopy = state.observers;
  state.observer = null;
  if (!observerCopy) {
    // FIXME: In debug mode, we may want to log this
    return;
  }
  for (var i = 0; i < observerCopy.length; ++i) {
    var obs = observerCopy[i];
    var onResolve = obs[0];
    var onReject = obs[1];
    var next = obs[2];
    box2(onResolve, onReject, isResolve, value, next);
  }
  // FIXME: In debug mode, we may want to notice if |isResolve == false|
  // but there is not a single onReject. It may be a clue that there is
  // something amiss. Perhaps we will want to log this, or perhaps we will
  // want to launch a setTimeout to refine this claim.
};

function isPromise(value) {
  /**
  Returns true if given `value` is promise. Value is assumed to be promise if
  it implements `then` method.
  **/
  return value && typeof(value.then) === 'function';
}

function defer(prototype) {
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

  ## Examples

  // Simple usage.
  var deferred = defer()
  deferred.promise.then(console.log, console.error)
  deferred.resolve(value)

  // Advanced usage
  var prototype = {
    get: function get(name) {
      return this.then(function(value) {
        return value[name];
      })
    }
  }

  var foo = defer(prototype)
  deferred.promise.get('name').then(console.log)
  deferred.resolve({ name: 'Foo' })
  //=> 'Foo'
  */

  // Performance note:
  // During the lifetime of a promise, we have the following costs:
  // - at initialization
  //   - create array |observers|;
  //   - create object |state|;
  //   - create closure |then|;
  //   - create closure |resolve|;
  //   - create closure |reject|;
  //   - either
  //      - create object {then: then}; or
  //      - create object {value: then}; and
  //      - create object {then: {value: then}}; and
  //      - create object |promise| with |Object.create|;
  //   - create object |{promise: ...}|
  // - during a call to |then|
  //   - create promise |promise|;
  //   - possibly create array |[ onResolve, onReject, promise]|;
  //   - otherwise, gc |onResolve, onReject, promise|;
  // - during a call to |resolve|
  //   - for each observer, one call to |next.resolve| or to |next.reject|;
  //   - possibly, gc previously allocated |onResolve, onReject|.
  // - during a call to |reject|
  //   - for each observer, one call to |next.resolve| or to |next.reject|;
  //   - possibly, gc previously allocated |onResolve, onReject|.

  // The state of the promise
  var state = {
    observers: [],
    result:    undefined,
    status:    undefined// |true| if resolved, |false| if rejected
  };

  var then = function then(onResolve, onReject) {
    var promise = defer(prototype);
    if (state.observers) {
      state.observers.push([onResolve, onReject, promise]);
    } else {
      box2(onResolve, onReject, state.status, state.value, promise);
    }
    return promise;
  };

  var resolve = function resolve(value) {
    if (isPromise(value)) {
      value.then(resolve, reject);
    } else {
      propagate(state, true, value);
    }
  };
  var reject = function reject(value) {
    // FIXME: We cannot reject with a promise.
    propagate(state, false, value);
  };

  /*
   *  FIXME: Benchmark this vs.
   * var resolve = propagate.bind(null, state, true);
   * var reject  = propagate.bind(null, state, false);
   */

  var promise;
  if (prototype) {
    promise = Object.create(prototype, {then: {value: then}});
  } else {
    promise = {then: then};
  }
  return {
    promise: promise,
    resolve: resolve,
    reject:  reject
  };
}
exports.defer = defer;

function resolve(value, prototype) {
  /**
  Returns a promise resolved to a given `value`. Optionally second `prototype`
  arguments my be provided to be used as a prototype for a returned promise.
  **/
  var deferred = defer(prototype);
  deferred.resolve(value);
  return deferred.promise;
}
exports.resolve = resolve;

function reject(reason, prototype) {
  /**
  Returns a promise that is rejected with a given `reason`. Optionally second
  `prototype` arguments my be provided to be used as a prototype for a returned
  promise.
  **/
  var deferred = defer(prototype);
  deferred.reject(reason);
  return deferred.promise;
}
exports.reject = reject;

var promised = (function() {
  // Note: Define shortcuts and utility functions here in order to avoid
  // slower property accesses and unnecessary closure creations on each
  // call of this popular function.

  var call = Function.call;
  var concat = Array.prototype.concat;

  // Utility function that does following:
  // execute([ f, self, args...]) => f.apply(self, args)
  function execute(args) { return call.apply(call, args); }

  // Utility function that takes promise of `a` array and maybe promise `b`
  // as arguments and returns promise for `a.concat(b)`.
  function promisedConcat(promises, unknown) {
    return promises.then(function(values) {
      return resolve(unknown).then(function(value) {
        return values.concat(value);
      });
    });
  }

      return function promised(f, prototype) {
        return function(/*...arguments*/) {
          if (!arguments) {
            return resolve (f(), prototype);
          }
          var pending = 0;                // Number of |arguments| that may still be promises
          var resolvedArguments = [];     // The resolved value of |arguments|
          var deferred = defer(prototype);// Our result
          var rejected = false;           // If |true|, we have rejected once already, no need to re-reject
          for (var i = 0; i < arguments.length; ++i) {
            var arg = arguments[i];
            if (!isPromise(arg)) {
              resolvedArguments[i] = arg;
              continue;
            }
            // If |arg| is a promise, wait for it to be resolved/rejected
            pending++;
            arg.then(
              function onResolve(value) {
                resolvedArguments[i] = value;
                if (!rejected && --pending == 0) {// This is the last value.
                  deferred.resolve(f.apply(null, resolvedArguments));
                }
              }, function onReject(reason) {
                if (!rejected) {
                  rejected = true;
                  deferred.reject(reason);
                }
              }
            );
          }

      // If no argument was a promise, resolve immediately
      if (pending == 0) {
        deferred.resolve(f(resolvedArguments));
      }
      return deferred;
    };
  };

  return function promised(f, prototype) {
    /**
    Returns a wrapped `f`, which when called returns a promise that resolves to
    `f(...)` passing all the given arguments to it, which by the way may be
    promises. Optionally second `prototype` argument may be provided to be used
    a prototype for a returned promise.

    ## Example

    var promise = promised(Array)(1, promise(2), promise(3))
    promise.then(console.log) // => [ 1, 2, 3 ]
    **/

    return function promised() {
      // create array of [ f, this, args... ]
      return concat.apply([ f, this ], arguments).
        // reduce it via `promisedConcat` to get promised array of fulfillments
        reduce(promisedConcat, resolve([], prototype)).
        // finally map that to promise of `f.apply(this, args...)`
        then(execute);
    };
  };
})();
exports.promised = promised;

});
