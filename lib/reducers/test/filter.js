"use strict";

var test = require("./util/test")
var lazy = require("./util/lazy")

var filter = require("../filter")
var into = require("../into")
var concat = require("../concat")
var delay = require("../delay")
var capture = require("../capture")


exports["test filter"] = function(assert) {
  var called = 0
  var source = [ 1, 2, 3 ]
  var actual = filter(source, function(item) {
    called = called + 1
    return item % 2
  })

  assert.equal(called, 0, "filter does not invokes until result is reduced")
  assert.deepEqual(into(actual), [ 1, 3 ], "items were filtered")
  assert.equal(called, 3, "filterer called once per item")
}

exports["test filter empty"] = test(function(assert) {
  var called = 0
  var filtered = filter([], function onEach(element) {
    called = called + 1
  })
  var actual = concat(filtered,
                      lazy(function() { return called }))

  assert(actual, [0], "filter `f` was not executed")
})

exports["test filter numbers"] = test(function(assert) {
  var called = 0
  var filtered = filter([1, 2, 3, 4], function(n) {
    called = called + 1
    return n % 2
  })
  var actual = concat(filtered,
                      lazy(function() { return called }))

  assert(actual, [1, 3, 4], "filter `f` was called once per element")
})

exports["test filter async stream"] = test(function(assert) {
  var called = 0
  var filtered = filter(delay([5, 4, 3, 2, 1]), function(n) {
    called = called + 1
    return n % 2
  })
  var actual = concat(filtered,
                      lazy(function() { return called }))

  assert(actual, [5, 3, 1, 5], "predicate was called once per element")
})

exports["test errors propagate"] = test(function(assert) {
  var boom = Error("Boom!")
  var filtered = filter(delay(concat([3, 2, 1], boom)), function(n) {
    return n % 2
  })
  var actual = capture(filtered, function(e) { return e.message })

  assert(actual, [3, 1, boom.message], "error do propagate")
})

if (require.main === module)
  require("test").run(exports)
