"use strict";

var core = require("../core")
var takeWhile = core.takeWhile
var END = core.END
var into = require("./util").into

exports["test takeWhile"] = function(assert) {
  var called = 0
  var input = takeWhile(function(item) {
    called = called + 1
    return item <= 2
  }, [1, 2, 3, 4])

  assert.equal(called, 0, "takeWhile does not invokes until signal is spawned")
  assert.deepEqual(into(input), [1, 2, END], "items were taken")
  assert.equal(called, 3, "taker called until it returns false")
  assert.deepEqual(into(input), [1, 2, END], "can be re-reduced")
  assert.equal(called, 6, "taker called again")
}

exports["test takeWhile none"] = function(assert) {
  var called = 0
  var input = takeWhile(function(item) {
    called = called + 1
    return false
  }, [1, 2, 3, 4])

  assert.equal(called, 0, "takeWhile does not invokes until signal is spawned")
  assert.deepEqual(into(input), [END], "0 items were taken")
  assert.equal(called, 1, "taker called once")
}

exports["test takeWhile all"] = function(assert) {
  var called = 0
  var input = takeWhile(function(item) {
    called = called + 1
    return true
  }, [1, 2, 3])

  assert.equal(called, 0, "takeWhile does not invokes until result is spawned")
  assert.deepEqual(into(input), [1, 2, 3, END], "all items were taken")
  assert.equal(called, 3, "taker called on each item")
}

exports["test take while on empty"] = function(assert) {
  var called = 0
  var input = takeWhile(function(n) {
    called = called + 1
    return n <= 9
  }, [])

  assert.deepEqual(into(input), [END],
                   "nothing to take from empty no calls to f")
  assert.equal(called, 0, "taker isn't called")
}

exports["test take more than exists"] = function(assert) {
  var called = 0
  var input = takeWhile(function(n) {
    called = called + 1
    return n <= 9
  }, [1, 2, 3, 4, 5, 6, 7])

  assert.deepEqual(into(input), [1, 2, 3, 4, 5, 6, 7, END],
                   "takes until exhasted")
}

exports["test error propagation in to take while"] = function(assert) {
  var called = 0
  var boom = Error("boom!")
  var input = takeWhile(function(n) {
    called = called + 1
    return n <= 9
  }, [1, 2, 3, 4, 5, boom, 6, 7])

  assert.deepEqual(into(input), [1, 2, 3, 4, 5, boom, 6, 7, END],
                   "called until error")
}
