"use strict";

var reducible = require("reducible/reducible")
var reduce = require("reducible/reduce")
var isReduced = require("reducible/is-reduced")
var end = require("reducible/end")
var setTimeout = require("timers").setTimeout;

function delay(source, ms) {
  ms = ms || 6 // Minimum 6ms, as on less dispatch order becomes unreliable
  return reducible(function reduceDelayed(next, result) {
    var timeout = 0
    var ended = false
    reduce(source, function reduceDelaySource(value) {
      setTimeout(function delayed() {
        if (!ended) {
          timeout = timeout - ms
          result = next(value, result)
          if (isReduced(result)) {
            ended = true
            next(end)
          }
        }
      }, timeout = timeout + ms)
      return result
    })
  })
}

module.exports = delay
