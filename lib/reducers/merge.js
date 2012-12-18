"use strict";

var reduce = require("reducible/reduce")
var reducible = require("reducible/reducible")
var end = require("reducible/end")
var isError = require("reducible/is-error")

function merge(source) {
  /**
  Merges given collection of collections to a collection with items of
  all nested collections. Note that items in the resulting collection
  are ordered by the time rather then index, in other words if item from
  the second nested collection is deliver earlier then the item
  from first nested collection it will in appear earlier in the resulting
  collection.

  print(merge([ [1, 2], [3, 4] ]))  // => < 1 2 3 4 >
  **/
  return reducible(function accumulateMerged(next, initial) {
    var state = initial
    var open = 1

    function forward(value) {
      if (value === end) {
        open = open - 1
        if (open === 0) return next(end)
      } else {
        state = next(value, state)
      }
      return state
    }


    reduce(source, function accumulateMergeSource(nested) {
      // If there is an error or end of `source` collection just pass it
      // to `forward` it will take care of detecting weather it's error
      // or `end`. In later case it will also figure out if it's `end` of
      // result to and act appropriately.
      if (nested === end) return forward(end)
      if (isError(nested)) return forward(nested)
      // If `nested` item is not end nor error just `accumulate` it via
      // `forward` that keeps track of all collections that are bing forwarded
      // to it.
      open = open + 1
      reduce(nested, forward, null)
    }, initial)
  })
}

module.exports = merge
