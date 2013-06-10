"use strict";

var core = require("./core")
var END = core.END
var STOP = core.STOP
var signal = core.signal
var spawn = core.spawn

function drain(consumers, value) {
  while (consumers.length) {
    var count = consumers.length
    var index = 0
    while (index < count) {
      var next = consumers[index]
      next(value)
      index = index + 1
    }
    consumers.splice(0, count)
  }
}

function dispatch(consumers, value) {
  var count = consumers.length
  var index = 0
  while (index < count) {
    var next = consumers[index]
    var result = next(value)
    // If consumer has finished accumulation remove it from the consumers
    // list. And dispatch end of stream on it (maybe that should not be
    // necessary).
    if (result === STOP) {
      consumers.splice(index, 1)
      next(END)
      // If consumer is removed than we decrease count as consumers array
      // will contain less elements (unless of course more elements were
      // added but we would like to ignore those).
      count = count - 1
    } else {
      index = index + 1
    }
  }
}

function hub(input) {
  var consumers = null

  function dispatcher(value) {
    if (consumers === null) return STOP
    if (value === END) drain(consumers, value)
    else dispatch(consumers, value)

    if (consumers.length === 0) {
      consumers = null
      return STOP
    }
  }

  return signal(function(next) {
    if (!consumers) {
      consumers = [next]
      spawn(input, dispatcher)
    } else if (consumers.indexOf(next) < 0) {
      consumers.push(next)
    }
  })
}
exports.hub = hub