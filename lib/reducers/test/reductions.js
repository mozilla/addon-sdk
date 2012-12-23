"use strict";

var test = require("./util/test")
var lazy = require("./util/lazy")
var delay = require("../delay")
var concat = require("../concat")
var capture = require("../capture")
var reductions = require("../reductions")

exports["test reductions over empty"] = test(function(assert) {
  var called = 0
  var source = reductions([], function(state, x) {
    called = called + 1
    return state + x
  })
  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))

  assert(actual, ["x", 0], "reductions over empty is empty")
})

exports["test reductions over null"] = test(function(assert) {
  var called = 0
  var source = reductions(null, function(state, x) {
    called = called + 1
    return state + x
  }, 0)
  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))

  assert(actual, ["x", 0], "reductions over null is empty")
})

exports["test reductions over void"] = test(function(assert) {
  var called = 0
  var source = reductions(void(0), function(state, x) {
    called = called + 1
    return state + x
  }, 0)
  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))

  assert(actual, ["x", 0], "reductions over void is empty")
})

exports["test reductions over number"] = test(function(assert) {
  var called = 0
  var source = reductions(0, function(state, x) {
    called = called + 1
    return state + x
  }, 0)
  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))

  assert(actual, [0, "x", 1], "reductions over number")
})


exports["test reductions over sequnce"] = test(function(assert) {
  var called = 0
  var source = reductions([1, 1, 1, 1], function(state, x) {
    called = called + 1
    return state + x
  }, 0)
  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))

  assert(actual, [1, 2, 3, 4, "x", 4], "reductions over number")
})

exports["test reductions over async"] = test(function(assert) {
  var called = 0
  var source = reductions(delay([1, 1, 1, 1]), function(state, x) {
    called = called + 1
    return state + x
  }, 0)
  var actual = concat(source,
                      "x",
                      lazy(function() { return called }))

  assert(actual, [1, 2, 3, 4, "x", 4], "reductions over number")
})

exports["test reductions over broken"] = test(function(assert) {
  var called = 0
  var boom = Error("boom")
  var source = reductions(delay([1, 1, 1, 1, boom]), function(state, x) {
    called = called + 1
    return state + x
  }, 0)
  var recovered = capture(source, function(error) { return error.message })
  var actual = concat(recovered,
                      "x",
                      lazy(function() { return called }))

  assert(actual, [1, 2, 3, 4, boom.message, "x", 4], "reductions over broken")
})

if (require.main === module)
  require("test").run(exports)
