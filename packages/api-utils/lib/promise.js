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

function resolution(value) {
  /**
  Returns non-standard compliant (`then` does not returns a promise) promise
  that resolves to a given `value`. For internal use.
  **/
  return { then: function then(resolve) { resolve(value); } };
}

function rejection(reason) {
  /**
  Returns non-standard compliant promise (`then` does not returns a promise)
  that rejects with a given `reason`. For internal use.
  **/
  return { then: function then(resolve, reject) { reject(reason); } };
}

function attempt(f) {
  /**
  Returns wrapper function that delegates to `f`. If `f` throws then captures
  error and returns promise that rejects with a thrown error. Otherwise returns
  return value. (Internal utility)
  **/
  return function effort(options) {
    try { return f(options); }
    catch(error) { return rejection(error); }
  };
}

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

  // Either an array of pairs of functions registered to be called
  // once we have a result, or |null|, if we already have a result.
  var observers = [];

  // Placeholder for a promise holding the result of resolving/rejecting
  // |promise|. Note that this result is *not* a value. Rather, if
  // |promise| has been |resolve|d with value |v|, |evaluated| is a
  // trivial promise in which |then| always succeeds with |v|.
  // If |promise| has been |rejected| with value |v|, |evaluated| is
  // a trivial promise in which |then| always fails with |v|. Finally,
  // if |promise| has been |resolve|d with a promise |p|, |evaluated| is
  // |p| itself.
  // Performance note: Shape of |evaluated| changes depending on case.
  // There may be ways to improve this.
  var evaluated;
  prototype = (prototype || prototype === null) ? prototype : Object.prototype;

  // Create an object implementing promise API, i.e. the capability to
  // observe the result of the promise through method |then|.
  var promise = Object.create(prototype, {
    then: { value: function then(onResolve, onReject) {
      // Create a new deferred using a same `prototype`.
      var deferred = defer(prototype);

      // Box |onResolve|/|onReject|:
      // - in case of success, the result is propagated as a resolution
      // - in case of error, the error is propagated as a rejection
      // - also handle the case in which |onResolve|/|onReject| is undefined.
      var boxedOnResolve = onResolve ? attempt(onResolve) : resolution;
      var boxedOnReject = onReject ? attempt(onReject) : rejection;

      // Create a pair of listeners for a enclosed promise resolution
      // / rejection that delegate to an actual callbacks and
      // resolve / reject returned promise.
      function resolved(value) { deferred.resolve(boxedOnResolve(value)); }
      function rejected(reason) { deferred.resolve(boxedOnReject(reason)); }

      // If promise is pending register listeners. Otherwise forward them to
      // resulting resolution.
      if (observers) observers.push([ resolved, rejected ]);
      else evaluated.then(resolved, rejected);

      return deferred.promise;
    }}
  });

  var deferred = {
    promise: promise,
    resolve: function resolve(value) {
      /**
      Resolves associated `promise` to a given `value`, unless it's already
      resolved or rejected.
      **/
      if (observers) {
        // Mark promise as resolved.
        var observersCopy = observers;
        observers = null;

        // store resolution `value` as a promise (`value` itself may be a
        // promise), so that all subsequent listeners can be forwarded to it,
        // which either resolves immediately or forwards if `value` is
        // a promise.
        evaluated = isPromise(value) ? value : resolution(value);

        // Forward to all pending observers.
        // Note that executing these observers can in turn trigger calls to
        // |this.resolve|, |this.reject| or |this.then|. Calls to |this.resolve|
        // or |this.reject| are ignored (re-resolving/re-rejecting a promise
        // is a meaningless operation), while calls to |this.then| are taken
        // into account immediately.
        observersCopy.forEach(function forEachObserver(obs) {
          evaluated.then(obs[0]/*onResolve*/, obs[1]/*onReject*/);
        });
      }
    },
    reject: function reject(reason) {
      /**
      Rejects associated `promise` with a given `reason`, unless it's already
      resolved / rejected.
      **/
      deferred.resolve(rejection(reason));
    }
  };

  return deferred;
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
