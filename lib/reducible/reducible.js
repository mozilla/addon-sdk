"use strict";

var reduce = require("./reduce")
var end = require("./end")
var isError = require("./is-error")
var isReduced = require("./is-reduced")
var reduced = require("./reduced")

function Reducible(reduce) {
  /**
  Reducible is a type of the data-structure that represents something
  that can be reduced. Most of the time it's used to represent transformation
  over other reducible by capturing it in a lexical scope.

  Reducible has an attribute `reduce` pointing to a function that does
  reduction.
  **/

  // JS engines optimize access to properties that are set in the constructor's
  // so we set it here.
  this.reduce = reduce
}

// Implementation of `accumulate` for reducible, which just delegates to it's
// `reduce` attribute.
reduce.define(Reducible, function reduceReducible(reducible, next, initial) {
  var result
  // State is intentionally accumulated in the outer variable, that way no
  // matter if consumer is broken and passes in wrong accumulated state back
  // this reducible will still behave as intended.
  var state = initial
  try {
    reducible.reduce(function forward(value) {
      try {
        // If reduce reduction has already being completed just return
        // `result` that is last state boxed in `reduced`. That way anything
        // trying to dispatch after it's closed or error-ed will just be handed
        // a `reduced` `state` indicating last value and no intent of getting
        // more values.
        if (result) return result

        // If value is an `error` (that also includes `end` of stream) we just
        // throw and let `catch` block do the rest of the job.
        if (value === end || isError(value)) throw value

        // Otherwise new `state` is accumulated `by` forwarding a `value` to an
        // actual `next` handler.
        state = next(value, state)

        // If new `state` is boxed in `reduced` than source should be stopped
        // and no more values should be forwarded to a `next` handler. To do
        // that we throw `end` and let `catch` block do the rest of the job.
        if (isReduced(state)) throw end

        // If code got that far then nothing special happened and `new` state is
        // just returned back, to a consumer.
        return state
      }
      // If `error` is thrown that may few things:
      //
      //  1. Last value dispatched was indicator of an error (that also includes
      //     `end` of stream).
      //  2. Provided `next` handler threw an exception causing stream failure.
      //
      // When this happens stream is either finished or error-ed, either way
      // no new items should get through. There for last `state` is boxed with
      // `reduced` and store as a `result` of this accumulation. Any subsequent
      // attempts of providing values will just get it in return, hopefully
      // causing source of value to get closed.
      catch (error) {
        if (isReduced(state)) {
          result = state
          state = result.value
        } else {
          result = reduced(state)
        }
        // Maybe we should console.error exceptions if such arise when calling
        // `next` in the following line.
        next(error, state)
        return result
      }
    }, null)
  } catch(error) {
    next(error, state)
  }
})

function reducible(reduce) {
  return new Reducible(reduce)
}
reducible.type = Reducible

module.exports = reducible
