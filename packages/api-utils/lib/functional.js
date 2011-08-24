/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: true latedef: false supernew: true browser: true */
/*global define: true port: true */
!(typeof define === "undefined" ? function ($) { $(require, exports, module); } : define)(function (require, exports, module, undefined) {

"use strict";

/**
 * Returns curried version of the given function.
 * @param {Function} target
 *    Function to curry.
 * @param {Number} [length=target.length||Infinity]
 *    Number of argument to curry. If not provided length of target function
 *    is used by default unless it's 0, in such case length will be infinity
 *    and function curry will stop once currier is executed without arguments.
 * @examples
 *
 *    var sum = curry(function(a, b) {
 *      return a + b
 *    })
 *    console.log(sum(2, 2)) // 4
 *    console.log(sum(2)(4)) // 6
 *
 *    var sum = curry(function() {
 *      return Array.prototype.reduce.call(arguments, function(sum, number) {
 *        return sum + number
 *      }, 0)
 *    })
 *    console.log(sum(2, 2)()) // 4
 *    console.log(sum(2, 4, 5)(-3)(1)()) // 9
 */
exports.curry = function curry(target, length) {
  return (function currier(target, length, args) {
    return function curried() {
      var rest = args.concat(Array.prototype.slice.call(arguments))
      // If all expected arguments are collected,
      return (rest.length >= length ||
      // or infinite number of arguments is expected and function was called
      // without arguments,
              (Infinity === length && arguments.length === 0)) ?
      // carried function is invoked with all the arguments collected. Otherwise
      // new curried function is returned to continue collecting arguments.
              target.apply(this, rest) : currier(target, length, rest);
    }
  })(target, length || target.length, []);
};

/**
 * Returns the composition of a list of functions, where each function consumes
 * the return value of the function that follows. In math terms, composing the
 * functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
 * @exmple
 *    var greet    = function(name){ return "hi: " + name; };
 *    var exclaim  = function(statement){ return statement + "!"; };
 *    var welcome = _.compose(exclaim, greet);
 *    welcome('moe');
 *    //> 'hi: moe!'
 */
exports.compose = (function Compose(slice) {
  return function compose() {
    var funcs = slice.call(arguments);
    return function composed() {
      var args = slice.call(arguments);
      var i = funcs.length;
      while (0 <= --i)
        args = [ funcs[i].apply(this, args) ];
      return args[0];
    };
  };
})(Array.prototype.slice);

/**
 * Function that returns it's argument
 */
exports.identity = function identity(value) {
  return value;
};


/**
 * Returns the value of `key` named property of the `target` object.
 */
exports.get = function get(key, target) {
  return target[key];
};

});
