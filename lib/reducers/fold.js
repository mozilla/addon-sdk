"use strict";

var reduce = require("reducible/reduce")
var isError = require("reducible/is-error")
var isReduced = require("reducible/is-reduced")
var end = require("reducible/end")

var Eventual = require("eventual/type")
var deliver = require("eventual/deliver")
var defer = require("eventual/defer")
var when = require("eventual/when")


// All eventual values are reduced same as the values they realize to.
reduce.define(Eventual, function reduceEventual(eventual, next, initial) {
  return when(eventual, function delivered(value) {
    return reduce(value, next, initial)
  }, function failed(error) {
    next(error, initial)
    return error
  })
})


function fold(source, next, initial) {
  /**
  Fold is just like `reduce` with a difference that `next` reducer / folder
  function it takes has it's parameters reversed. One always needs `value`,
  but not always accumulated one. To avoid conflict with array `reduce` we
  have a `fold`.
  **/
  var promise = defer()
  reduce(source, function fold(value, state) {
    // If source is `end`-ed deliver accumulated `state`.
    if (value === end) return deliver(promise, state)
    // If is source has an error, deliver that.
    else if (isError(value)) return deliver(promise, value)

    // Accumulate new `state`
    try { state = next(value, state) }
    // If exception is thrown at accumulation deliver thrown error.
    catch (error) { return deliver(promise, error) }

    // If already reduced, then deliver.
    if (isReduced(state)) deliver(promise, state.value)

    return state
  }, initial)

  // Wrap in `when` in case `promise` is already delivered to return an
  // actual value.
  return when(promise)
}

module.exports = fold
