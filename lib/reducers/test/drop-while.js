"use strict";

var test = require("./util/test")
var lazy = require("./util/lazy")

var concat = require("../concat")
var dropWhile = require("../drop-while")
var into = require("../into")
var delay = require("../delay")
var capture = require("../capture")


exports["test drop while"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3, 4 ]
  var actual = dropWhile(source, function(item) {
    called = called + 1
    return item <= 2
  })

  assert.equal(called, 0, "dropWhile does not invokes until result is reduced")
  assert.deepEqual(into(actual), [ 3, 4 ], "items were dropped")
  assert.equal(called, 3, "dropWhile called until it returns false")
  assert.deepEqual(into(actual), [ 3, 4 ], "can be re-reduced")
}

exports["test drop while none"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3 ]
  var actual = dropWhile(source, function(item) {
    called = called + 1
    return false
  })

  assert.equal(called, 0, "dropWhile does not invokes until result is reduced")
  assert.deepEqual(into(actual), [ 1, 2, 3 ], "0 items were dropped")
  assert.equal(called, 1, "dropper called only once")
}

exports["test drop while all"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3 ]
  var actual = dropWhile(source, function(item) {
    called = called + 1
    return true
  })

  assert.equal(called, 0, "dropWhile does not invokes until result is reduced")
  assert.deepEqual(into(actual), [], "all items were dropped")
  assert.equal(called, 3, "dropper called on each item")
}

exports["test drop while on empty"] = test(function(assert) {
  var called = 0
  var dropped = dropWhile([], function(n) {
    called = called + 1
    return n <= 9
  })

  var actual = concat(dropped,
                      lazy(function() { return called }))

  assert(actual, [0], "nothing to drop")
})

exports["test drop.while"] = test(function(assert) {
  var called = 0
  var dropped = dropWhile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], function(n) {
    called = called + 1
    return n <= 9
  })
  var actual = concat(dropped,
                      lazy(function() { return called }))

  assert(actual, [10, 11, 12, 10], "called until returned false")
})

exports["test drop.while end"] = test(function(assert) {
  var called = 0
  var dropped = dropWhile([1, 2, 3, 4, 5, 6, 7], function(n) {
    called = called + 1
    return n <= 9
  })
  var actual = concat(dropped,
                      lazy(function() { return called }))

  assert(actual, [7], "called until returned false")
})

exports["test drop while on async stream"] = test(function(assert) {
  var called = 0
  var stream = delay([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  var dropped = dropWhile(stream, function(n) {
    called = called + 1
    return n <= 9
  })
  var actual = concat(dropped,
                      lazy(function() { return called }))

  assert(actual, [10, 11, 12, 10], "called until returned false")
})

exports["test error propagation in drop.while"] = test(function(assert) {
  var called = 0, boom = Error("boom!")
  var stream = concat([1, 2, 3, 4, 5], boom, [6, 7])
  var dropped = dropWhile(stream, function(n) {
    called = called + 1
    return n <= 3
  })
  var captured = capture(dropped, function(error) { return error.message })
  var actual = concat(captured,
                      lazy(function() { return called }))

  assert(actual, [4, 5, boom.message, 4], "called until error ocurred")
})

if (require.main === module)
  require("test").run(exports)
