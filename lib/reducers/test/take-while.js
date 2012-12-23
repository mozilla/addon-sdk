"use strict";

var test = require("./util/test")
var lazy = require("./util/lazy")
var concat = require("../concat")
var delay = require("../delay")
var capture = require("../capture")

var takeWhile = require("../take-while")
var into = require("../into")

exports["test takeWhile"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3, 4 ]
  var actual = takeWhile(source, function(item) {
    called = called + 1
    return item <= 2
  })

  assert.equal(called, 0, "takeWhile does not invokes until result is reduced")
  assert.deepEqual(into(actual), [ 1, 2 ], "items were taken")
  assert.equal(called, 3, "taker called until it returns false")
  assert.deepEqual(into(actual), [ 1, 2 ], "can be re-reduced")
}

exports["test takeWhile none"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3, 4 ]
  var actual = takeWhile(source, function(item) {
    called = called + 1
    return false
  })

  assert.equal(called, 0, "takeWhile does not invokes until result is reduced")
  assert.deepEqual(into(actual), [], "0 items were taken")
  assert.equal(called, 1, "taker called once")
}

exports["test takeWhile all"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3 ]
  var actual = takeWhile(source, function(item) {
    called = called + 1
    return true
  })

  assert.equal(called, 0, "takeWhile does not invokes until result is reduced")
  assert.deepEqual(into(actual), [ 1, 2, 3 ], "all items were taken")
  assert.equal(called, 3, "taker called on each item")
}

exports["test take while on empty"] = test(function(assert) {
  var called = 0
  var source = takeWhile([], function(n) {
    called = called + 1
    return n <= 9
  })

  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))

  assert(actual, ["x", 0], "nothing to take from empty no calls to f")
})

exports["test take while"] = test(function(assert) {
  var called = 0
  var source = takeWhile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], function(n) {
    called = called + 1
    return n <= 9
  })

  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))


  assert(actual, [1, 2, 3, 4, 5, 6, 7, 8, 9, "x", 10],
         "called until returned false")
})

exports["test take while ends"] = test(function(assert) {
  var called = 0
  var source = takeWhile([1, 2, 3, 4, 5, 6, 7], function(n) {
    called = called + 1
    return n <= 9
  })

  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))


  assert(actual, [1, 2, 3, 4, 5, 6, 7, "x", 7],
         "takes until exhasted")
})

exports["test take while on async stream"] = test(function(assert) {
  var called = 0
  var source =  delay([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  var taken = takeWhile(source, function(n) {
    called = called + 1
    return n <= 9
  })
  var actual = concat(taken,
                      "x",
                      lazy(function() { return called }))



  assert(actual, [1, 2, 3, 4, 5, 6, 7, 8, 9, "x", 10],
        "called until returned false")
})

exports["test error propagation in to take while"] = test(function(assert) {
  var called = 0, boom = Error("boom!")
  var source = concat([1, 2, 3, 4, 5], boom, [6, 7])
  var taken = takeWhile(source, function(n) {
    called = called + 1
    return n <= 9
  })
  var recovered = capture(taken, function(error) {
    return error.message
  })
  var actual = concat(recovered,
                      "x",
                      lazy(function() { return called }))

  assert(actual, [1, 2, 3, 4, 5, boom.message, "x", 5], "called until error")
})


if (module == require.main)
  require("test").run(exports)
