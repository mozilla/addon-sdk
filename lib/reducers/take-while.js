"use strict";

var reducer = require("./reducer")
var end = require("reducible/end")


var takeWhile = reducer(function takeWhile(predicate, next, value, result) {
  /**
  Returns a sequence of successive items from `source` while `predicate(item)`
  returns `true`. `predicate` must be free of side-effects.

  ## Example

  var digits = takeWhile([ 2, 7, 10, 23 ], function(x) { return x < 10 })
  print(digits)   // => < 2 7 >
  **/
  return predicate(value) ? next(value, result) :
         // Predicate returned `false` just pass `end`. Reducer will take
         // care of returning `reduced(result)` back.
         next(end)
})

module.exports = takeWhile
