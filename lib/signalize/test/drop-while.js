"use strict";

var core = require("../core")
var dropWhile = core.dropWhile
var END = core.END
var into = require("./util").into

exports["test drop while"] = function(assert) {
  var called = 0
  var input = dropWhile(function(item) {
    called = called + 1
    return item <= 2
  }, [1, 2, 3, 4])

  assert.equal(called, 0, "dropWhile does not invokes until signal is spawn")
  assert.deepEqual(into(input), [3, 4, END], "items were dropped")
  assert.equal(called, 3, "dropWhile called until it returns false")
  assert.deepEqual(into(input), [3, 4, END], "can be re-reduced")
  assert.equal(called, 6, "dropWhile calls dropper at each spawn")
}

exports["test drop while none"] = function(assert) {
  var called = 0
  var input = dropWhile(function(item) {
    called = called + 1
    return false
  }, [1, 2, 3])

  assert.equal(called, 0, "dropWhile does not invokes until signal is spawned")
  assert.deepEqual(into(input), [1, 2, 3, END], "0 items were dropped")
  assert.equal(called, 1, "dropper called only once")
}

exports["test drop while all"] = function(assert) {
  var called = 0
  var input = dropWhile(function(item) {
    called = called + 1
    return true
  }, [1, 2, 3])

  assert.equal(called, 0, "dropWhile does not invokes until signal is spawn")
  assert.deepEqual(into(input), [END], "all items were dropped")
  assert.equal(called, 3, "dropper called on each item")
}

exports["test drop while on empty"] = function(assert) {
  var called = 0
  var input = dropWhile(function(n) {
    called = called + 1
    return n <= 9
  }, [])

  assert.deepEqual(into(input), [END], "nothing to drop")
  assert.equal(called, 0, "not called on empty")
}

exports["test drop many"] = function(assert) {
  var called = 0
  var input = dropWhile(function(n) {
    called = called + 1
    return n <= 9
  }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

  assert.deepEqual(into(input), [10, 11, 12, END],
                   "skip until false is returned")
  assert.equal(called, 10,  "called until returned false")
}

exports["test drop while end"] = function(assert) {
  var called = 0
  var input = dropWhile(function(n) {
    called = called + 1
    return n <= 9
  }, [1, 2, 3, 4, 5, 6, 7])

  assert.deepEqual(into(input), [END], "none taken")
  assert.equal(called, 7, "called until returned false")
}

exports["test error propagation in drop while"] = function(assert) {
  var called = 0
  var boom = Error("boom!")
  var input = dropWhile(function(n) {
    called = called + 1
    return n <= 3
  }, [1, 2, 3, 4, 5, boom, 6, 7])

  assert.deepEqual(into(input), [4, 5, boom, 6, 7, END],
                   "called until true returned")
  assert.equal(called, 4, "called until true is returned")
}
