"use strict";

var reducible = require("reducible/reducible")
var reduce = require("reducible/reduce")
var end = require("reducible/end")

function take(source, n) {
  /**
  Returns sequence of first `n` items of the given `source`. If `source`
  contains less items than `n` then that's how  much items return sequence
  will contain.

  ## Example

  print(take([ 1, 2, 3, 4, 5 ], 2))   // => < 1 2 >
  print(take([ 1, 2, 3 ], 5))         // => < 1 2 3 >
  **/

  // If take `0` then optimize by returning an empty if less then `0`
  // then just return `source` back.
  if (n === 0) return void(0)
  if (n < 0) return source
  return reducible(function reduceTake(next, initial) {
    // Capture `n` into count, since modifying `n` directly will have side
    // effects on subsequent calls.
    var count = n
    reduce(source, function reduceTakeSource(value, result) {
      count = count - 1
      result = next(value, result)

      // If we have not taken `n` items yet just pass result back. Otherwise
      // pass `end` of stream to a consumer. Note `reducible` will return
      // `reduced(result)` back signaling source it should stop.
      return count > 0 ? result :
             next(end)
    }, initial)
  })
}

module.exports = take
