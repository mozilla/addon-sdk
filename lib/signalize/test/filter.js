"use strict";

var core = require("../core")
var filter = core.filter
var END = core.END
var into = require("./util").into


exports["test filter"] = function(assert) {
  var called = 0
  var input = filter(function(item) {
    called = called + 1
    return item % 2
  }, [ 1, 2, 3 ])

  assert.equal(called, 0, "filterer is isn't called until signal is spawned")
  assert.deepEqual(into(input), [1, 3, END], "items were filtered")
  assert.equal(called, 3, "filterer called once per item")
}

exports["test filter empty"] = function(assert) {
  var called = 0
  var input = filter(function onEach(element) {
    called = called + 1
  }, [])

  assert.equal(called, 0, "filterer isn't called until signal is spawned")
  assert.deepEqual(into(input), [END], "filtering empty is empty")
  assert.equal(called, 0, "filterer never called on empty")
}


exports["test errors propagate"] = function(assert) {
  var boom = Error("Boom!")
  var input = filter(function(n) {
    return n % 2
  }, [3, 2, 1, boom])

  assert.deepEqual(into(input), [3, 1, boom, END], "errors do propagate")
}

exports["test filter with multi errors"] = function(assert) {
  var boom = Error("Boom!")
  var input = filter(function(n) {
    return n % 2
  }, [3, 2, boom, 1, boom])

  assert.deepEqual(into(input), [3, boom, 1, boom, END], "errors do propagate")
}