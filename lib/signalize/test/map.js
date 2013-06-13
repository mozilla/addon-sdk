"use strict";

var core = require("../core")
var map = core.map
var END = core.END
var into = require("./util").into

exports["test map array"] = function(assert) {
  var called = 0
  var input = map(function(item) {
    called = called + 1
    return item + 10
  }, [1, 2, 3])

  assert.equal(called, 0, "map does not invokes until signal is spawned")
  assert.deepEqual(into(input), [ 11, 12, 13, END ], "values are mapped")
  assert.equal(called, 3, "mapper called once per item")
}

exports["test map singular"] = function(assert) {
  var called = 0
  var input = map(function(item) {
    called = called + 1
    return item + 10
  }, 7)

  assert.equal(called, 0, "map does not invokes until signal is spawned")
  assert.deepEqual(into(input), [ 17, END ], "values is mapped")
  assert.equal(called, 1, "mapper called once per item")
}

exports["test map empty"] = function(assert) {
  var input = map(function(element) {
    throw Error("map fn was executed")
  }, [])

  assert.deepEqual(into(input), [END], "mapping empty is empty")
}


exports["test number map"] = function(assert) {
  var input = map(function(number) {
    return number * 2
  }, [1, 2, 3, 4])

  assert.deepEqual(into(input), [2, 4, 6, 8, END], "numbers are doubled")
}

exports["test map with error"] = function(assert) {
  var boom = Error("Boom!")
  var source = [3, 2, 1, boom]
  var input = map(function(x) { return x * x }, source)

  assert.deepEqual(into(input), [9, 4, 1, boom, END], "errors propagate")
}

exports["test map with multi errors"] = function(assert) {
  var boom = Error("Boom!")
  var source = [3, 2, boom, 1, boom, 0]
  var input = map(function(x) { return x * x }, source)

  assert.deepEqual(into(input), [9, 4, boom, 1, boom, 0, END],
                   "errors propagate")
}
