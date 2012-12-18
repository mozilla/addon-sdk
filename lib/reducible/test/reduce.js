"use strict";

var reduce = require("../reduce")
var end = require("../end")
var reduced = require("../reduced")

exports["test reduce"] = function(assert) {
  var actual = []
  reduce([1, 2, 3], function(value, result) {
    actual.push(value, result)
    return value + result
  }, 0)

  assert.deepEqual(actual, [1, 0, 2, 1, 3, 3, end, 6],
                   "reduce is passed all the values")
}

exports["test reduced early"] = function(assert) {
  var actual = []
  reduce([1, 2, 3], function(value, result) {
    actual.push(value, result)
    return reduced("nope")
  }, 0)

  assert.deepEqual(actual, [1, 0], "early reduce value is accumulated")
}

exports["test reduce errored"] = function(assert) {
  var actual = []
  var boom = Error("Boom!")
  var result = reduce([1, 2, boom, 3, 4], function(value) {
    actual.push(value)
  }, 0)

  assert.deepEqual(actual, [1, 2, boom], "errors end source and propagate")
}

exports["test reduce late error"] = function(assert) {
  var actual = []
  var boom = Error("Boom!")
  var result = reduce([1, 2, boom, 4], function(value) {
    actual.push(value)
    return reduced("Wheuh")
  }, 0)

  assert.deepEqual(actual, [1], "late errors are irrelevant")
}

exports["test reduce null"] = function(assert) {
  var actual = []
  reduce(null, function(value) {
    actual.push(value)
  })

  assert.deepEqual(actual, [end], "null reduces as empty")
}

exports["test reduce void"] = function(assert) {
  var actual = []
  reduce(void(0), function(value) {
    actual.push(value)
  })

  assert.deepEqual(actual, [end], "void reduces as empty")
}

exports["test reduce empty"] = function(assert) {
  var actual = []
  reduce([], function(value) {
    actual.push(value)
  })

  assert.deepEqual(actual, [end], "[] reduces as empty")
}

exports["test reduce string"] = function(assert) {
  var actual = []
  var result = reduce("world", function(value) {
    actual.push(value)
  })

  assert.deepEqual(actual, ["world", end],
                   "string is equivalent of collection of itself")
}

exports["test reduce number"] = function(assert) {
  var actual = []
  reduce(7, function(value) {
    actual.push(value)
  })

  assert.deepEqual(actual, [7, end],
                   "number is equivalent of collection of itself")
}

exports["test reduce object"] = function(assert) {
  var actual = []
  reduce({}, function(value) {
    actual.push(value)
  })

  assert.deepEqual(actual, [{}, end], "object is collection of itself")
}

exports["test reduce error"] = function(assert) {
  var actual = []
  var boom = Error("Boom!")
  reduce(boom, function(value) {
    actual.push(boom)
  })

  assert.deepEqual(actual, [boom], "error is errored collection")
}

if (require.main === module)
  require("test").run(exports)
