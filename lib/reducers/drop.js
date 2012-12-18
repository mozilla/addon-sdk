"use strict";

var reducible = require("reducible/reducible")
var reduce = require("reducible/reduce")
var isError = require("reducible/is-error")
var end = require("reducible/end")

function drop(source, n) {
  /**
  Returns sequence of all `source`'s items after `n`-th one. If source contains
  less then `n` items empty sequence is returned.

  ## Example

  print(drop([ 1, 2, 3, 4 ], 2))  // => <stream 3 4 />
  print(drop([ 1, 2, 3 ], 5))     // => <stream />
  **/

  // If drop `<= 0` then optimize by returning source itself. If `Infinity`
  // return empty.
  if (n <= 0) return source
  if (n === Infinity) return void(0)
  return reducible(function reduceDrop(next, initial) {
    var count = n
    reduce(source, function reduceDropSource(value, result) {
      // If value is end of collection or is an error (which also includes
      // end of collection) just pass it through, `reducible` will take care
      // of everything.
      if (value === end) return next(value, result)
      if (isError(value)) return next(value, result)
      // If count of items has reached `0` just keep on passing values.
      if (count === 0) return next(value, result)
      // Otherwise just decrement count and return `result`.
      count = count - 1
      return result
    }, initial)
  })
}

module.exports = drop
