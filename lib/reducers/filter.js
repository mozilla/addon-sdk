"use strict";

var reducer = require("./reducer")

var filter = reducer(function filter(predicate, next, value, result) {
  /**
  Composes filtered version of given `source`, such that only items contained
  will be once on which `f(item)` was `true`.

  ## Example

  var digits = filter([ 10, 23, 2, 7, 17 ], function(value) {
    return value >= 0 && value <= 9
  })
  print(digits) // => < 2 7 >
  **/
  return predicate(value) ? next(value, result) :
         result
})

module.exports = filter
