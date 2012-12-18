"use strict";

var reducible = require("../reducible")

var reduce = require("../reduce")
var end = require("../end")
var reduced = require("../reduced")

exports["test reducible"] = function(assert) {
  var actual = []
  var fixture = reducible(function(next, result) {
    result = next(1, result)
    result = next(2, result)
    next(end, result)
  })

  reduce(fixture, function(value, result) {
    actual.push(value, result)
    return result + value
  }, 0)

  assert.deepEqual(actual, [1, 0, 2, 1, end, 3], "reducible works")
}

exports["test error force ends reducibles"] = function(assert) {
  var actual = []
  var boom = Error("boom!!")
  var fixture = reducible(function(next, result) {
    result = next(1, result)
    next(boom, result)
    next(2)
    next(Error("BraxxxX"))
    next(3)
    next(end)
    next(4)
  })

  reduce(fixture, function(value, result) {
    actual.push(value, result)
    return result + value
  }, 0)

  assert.deepEqual(actual, [1, 0, boom, 1], "error ends reducible")
}

exports["test end force end reducibles"] = function(assert) {
  var actual = []
  var fixture = reducible(function(next, result) {
    result = next(1, result)
    next(end, result)
    next(2)
    next(3)
    next(Error("Boom!!"))
    next(4)
    next(end)
    next(5)
  })

  reduce(fixture, function(value, result) {
    actual.push(value, result)
    return result + value
  }, 0)

  assert.deepEqual(actual, [1, 0, end, 1], "end force ends reducible")
}

exports["test exceptions force end reducibles"] = function(assert) {
  var actual = []
  var boom = Error("Boom!!")
  var fixture = reducible(function(next, result) {
    result = next(1, result)
    result = next(2, result)
    result = next(3, result)
    result = next(4, result)
    next(end, result)
  })

  reduce(fixture, function(value, result) {
    if (value === 3) throw boom
    actual.push(value, result)
    return result + value
  }, 0)

  assert.deepEqual(actual, [1, 0, 2, 1, boom, 3],
                   "exception force ends reducible")
}

exports["test exceptions in reducible force end"] = function(assert) {
  var actual = []
  var boom = Error("Boom!!")
  var fixture = reducible(function(next, result) {
    result = next(1, result)
    throw boom
  })

  reduce(fixture, function(value, result) {
    actual.push(value, result)
    return result + value
  }, 0)

  assert.deepEqual(actual, [1, 0, boom, 1],
                   "exceptions in reducible force end")
}

if (require.main === module)
  require("test").run(exports)
