/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint undef: true es5: true node: true browser: true devel: true
         forin: true latedef: false */
/*global define: true, Cu: true, __URI__: true */
;(function(id, factory) { // Module boilerplate :(
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(require) === 'function') { // CommonJS
    factory.call(this, require, exports, module);
  } else if (String(this).indexOf('BackstagePass') >= 0) { // JSM
    factory(function require(uri) {
      var imports = {};
      this['Components'].utils.import(uri, imports);
      return imports;
    }, this, { uri: __URI__, id: id });
    this.EXPORTED_SYMBOLS = Object.keys(this);
  } else {  // Browser or alike
    var globals = this;
    factory(function require(id) {
      return globals[id];
    }, (globals[id] = {}), { uri: document.location.href + '#' + id, id: id });
  }
}).call(this, 'promise', function(require, exports, module) {

'use strict';

var core = require('./promise/core');

// Note: Define shortcuts and utility functions here in order to avoid
// slower property accesses and unnecessary closure creations on each
// call of this popular function.
var call = Function.call;
var concat = Array.prototype.concat;

var defer = core.defer, resolve = core.resolve, reject = core.reject;

exports.defer = defer;
exports.resolve = resolve;
exports.reject = reject;

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

function promised(f) {
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
      reduce(promisedConcat, resolve([])).
      // finally map that to promise of `f.apply(this, args...)`
      then(execute);
  };
}
exports.promised = promised;

});
