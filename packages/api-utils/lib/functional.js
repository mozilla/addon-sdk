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
  length = length || target.length || Infinity
  return function curried() {
    var self = this, args = [];
    return (function currier() {
      // If no argument is being curried (`currier` is called with 0
      // arguments) and infinite number of arguments is expected we stop
      // currying. Else if number of expected arguments is already collected
      // we stop currying. One we stop currying we apply collected arguments
      // to the target `funciton` and return result. If currying is not
      // stopped we return `currier` to continue currying.
      return ((args.length === args.push.apply(args, arguments)
               && Infinity === length) || args.length >= length) ?
             target.apply(self, args) : currier
    }).apply(self, arguments);
  }
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

});
