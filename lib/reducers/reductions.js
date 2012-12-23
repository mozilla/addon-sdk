"use strict";

var reduce = require("reducible/reduce")
var reducible = require("reducible/reducible")
var end = require("reducible/end")
var isError = require("reducible/is-error")

function reductions(source, f, initial) {
  /**
  Returns `reducible` collection of the intermediate values of the reduction
  (as per reduce) of `source` by `f`, starting with `initial` value.

  ## Example

  var numbers = reductions([1, 1, 1, 1], function(accumulated, value) {
    return accumulated + value
  }, 0)
  print(numbers) // => < 1 2 3 4 >
  **/
  return reducible(function reduceReductions(next, start) {
    var state = initial
    return reduce(source, function reduceReductionsSource(value, result) {
      if (value === end) return next(end, result)
      if (isError(value)) return next(value, result)
      state = f(state, value)
      return next(state, result)
    }, start)
  })
}

module.exports = reductions
