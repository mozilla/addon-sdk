"use strict";

var test = require("./util/test")
var delay = require("../delay")
var concat = require("../concat")
var capture = require("../capture")
var map = require("../map")
var into = require("../into")

exports["test map sequence"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3 ]
  var actual = map(source, function(item) {
    called = called + 1
    return item + 10
  })

  assert.equal(called, 0, "map does not invokes until result is reduced")
  assert.deepEqual(into(actual), [ 11, 12, 13 ], "values are mapped")
  assert.equal(called, 3, "mapper called once per item")
}

exports["test map value"] = function(assert) {
  var called = 0
  var actual = map(7, function(item) {
    called = called + 1
    return item + 10
  })

  assert.equal(called, 0, "map does not invokes until result is reduced")
  assert.deepEqual(into(actual), [ 17 ], "values is mapped")
  assert.equal(called, 1, "mapper called once per item")
}

exports["test map empty"] = test(function(assert) {
  var actual = map([], function(element) {
    throw Error("map fn was executed")
  })

  assert(actual, [], "mapping empty is empty")
})


exports["test number map"] = test(function(assert) {
  var numbers = [1, 2, 3, 4]
  var actual = map(numbers, function(number) { return number * 2 })

  assert(actual, [2, 4, 6, 8], "numbers are doubled")
})

exports["test map with async stream"] = test(function(assert) {
  var source = delay([5, 4, 3, 2, 1])
  var actual = map(source, function(x) { return x + 1 })
  assert(actual, [6, 5, 4, 3, 2], "async number stream is incermented")
})

exports["test map broken stream"] = test(function(assert) {
  var boom = Error("Boom!")
  var source = concat([3, 2, 1], boom)
  var mapped = map(delay(source), function(x) { return x * x })
  var actual = capture(mapped, function(error) { return error.message })

  assert(actual, [9, 4, 1, boom.message], "errors propagate")
})

if (require.main === module)
  require("test").run(exports)
