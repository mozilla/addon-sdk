"use strict";

var reducible = require("reducible/reducible")
var reduce = require("reducible/reduce")
var isError = require("reducible/is-error")
var end = require("reducible/end")

function dropWhile(source, predicate) {
  /**
  Returns a sequence of the items in `source` starting from the first
  item for which `predicate(item)` returns `false`.

  ## Example

  var numbers = dropWhile([ 2, 7, 10, 23 ], function(value) {
    return value < 10
  })
  print(numbers)   // => < 10 23 >
  **/
  return reducible(function reduceDropWhile(next, initial) {
    var dropped = false
    reduce(source, function reduceDropWhileSource(value, result) {
      // If value is end of collection or is an error (which also includes
      // end of collection) just pass it through, `reducible` will take care
      // of everything.
      if (value === end) return next(value, result)
      if (isError(value)) return next(value, result)

      // If already dropped all the intended items (if `dropped` is already
      // being set to `true` or if current predicate returns `false`). Then
      // just keep on passing values.
      if (dropped || (dropped = !predicate(value))) return next(value, result)

      return result
    }, initial)
  })
}

module.exports = dropWhile
