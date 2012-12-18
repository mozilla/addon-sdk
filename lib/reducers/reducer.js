"use strict";

var reduce = require("reducible/reduce")
var reducible = require("reducible/reducible")
var isError = require("reducible/is-error")
var end = require("reducible/end")


function reducer(process) {
  /**
  Convenience function to simplify definitions of transformation function, to
  avoid manual definition of `reducible` results and currying transformation
  function. It creates typical transformation function with a following
  signature:

      transform(source, options)

  From a pure data `process` function that is called on each value for a
  collection with following arguments:

    1. `options` - Options passed to the resulting transformation function
       most commonly that's a function like in `map(source, f)`.
    2. `next` - Function which needs to be invoked with transformed value,
       or simply not called to skip the value.
    3. `value` - Last value emitted by a collection being reduced.
    4. `result` - Accumulate value.

  Function is supposed to return new, accumulated `result`. It may either
  pass mapped transformed `value` and `result` to the `next` continuation
  or skip it.

  For example see `map` and `filter` functions.
  **/
  return function reducer(source, options) {
    // When return transformation function is called with a source and
    // `options`
    return reducible(function reduceReducer(next, initial) {
      // When actual result is 
      reduce(source, function reduceReducerSource(value, result) {
        // If value is `end` of source or an error just propagate through,
        // otherwise call `process` with all the curried `options` and `next`
        // continuation function.
        return value === end ? next(value, result) :
               isError(value) ? next(value, result) :
               process(options, next, value, result)
      })
    })
  }
}

module.exports = reducer
