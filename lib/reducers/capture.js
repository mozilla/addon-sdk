"use strict";

var reducible = require("reducible/reducible")
var reduce = require("reducible/reduce")
var reduced = require("reducible/reduced")
var isError = require("reducible/is-error")

function capture(source, recover) {
  /**
  Creates and returns safe version of given `source` sequence, by using
  `recover` function to recover from errors that may occur while reducing
  a `source`. This is a mechanism for error handling and recovery for streams
  that representing IO operations like (XHR / WebSockets etc...) where errors
  may occur.
  **/
  return reducible(function reduceCapture(next, initial) {
    var failure = void(0)
    reduce(source, function reduceCaptureSource(value, result) {
      // If error has already being captured then return
      if (failure) return failure
      // If value is an error then continue accumulation of recovered
      // sequence.
      else if (isError(value)) {
        failure = reduced(result)
        reduce(recover(value, result), next, result)
        return failure
      }
      // Otherwise just forward messages.
      else return next(value, result)
    }, initial)
  })
}

module.exports = capture
