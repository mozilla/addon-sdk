"use strict";

var core = require("../core")
var concat = core.concat
var take = core.take
var END = core.END
var STOP = core.STOP
var into = require("./util").into

exports["test concat"] = function(assert) {
  var input = concat([ 1 ], [ 2, 3 ], [ 4, 5, 6 ])

  assert.deepEqual(into(input), [1, 2, 3, 4, 5, 6, END],
                   "all joined")
  assert.deepEqual(into(input), [1, 2, 3, 4, 5, 6, END],
                   "can be re-spawned")
}

exports["test concat empty streams"] = function(assert) {
  var input = concat([], [])

  assert.deepEqual(into(input), [END], "concat on empties is empty")
}

exports["test concat empty"] = function(assert) {
  var input = concat([1, 2], [])

  assert.deepEqual(into(input), [1, 2, END], "concat with empty returns same")
}

exports["test concat to empty"] = function(assert) {
  var input = concat([], [3, 4])

  assert.deepEqual(into(input), [3, 4, END], "concat to empty returns same")
}

exports["test concat many"] = function(assert) {
  var input = concat([1, 2], [], ["a", "b"], [])

  assert.deepEqual(into(input), [1, 2, "a", "b", END], "many concats work")
}

exports["test concat & reconcat"] = function(assert) {
  var a = [2, 1]
  var b = concat(a, "ab")
  var input = concat(a, ["||"], b)

  assert.deepEqual(into(input), [2, 1, "||", 2, 1, "a", "b", END],
                   "concat reconcat")
}

exports["test concat to error"] = function(assert) {
  var boom = Error("Boom!")
  var input = concat(boom, [1, 2, 3])

  assert.deepEqual(into(input), [boom, 1, 2, 3, END],
                   "error interrupts concat")
}


exports["test concat & error"] = function(assert) {
  var boom = Error("Boom!")
  var input = concat([1, 2, 3], boom)

  assert.deepEqual(into(input), [1, 2, 3, boom, END],
                   "signal has an error")
}

exports["test concat signal & error & signal"] = function(assert) {
  var boom = Error("Boom!")
  var input = concat([1, 2, 3], boom, [4, 5, 6])

  assert.deepEqual(into(input), [1, 2, 3, boom, 4, 5, 6, END],
                   "signal has an error")
}

exports["test stop at concatination"] = function(assert) {
  var source = concat([1, 2, 3], [4, 5])
  var input = take(3, source)

  assert.deepEqual(into(input), [1, 2, 3, END],
                   "take 3 items")
}

exports["test stop at left branch"] = function(assert) {
  var source = concat([1, 2, 3], [4, 5])
  var input = take(2, source)

  assert.deepEqual(into(input), [1, 2, END],
                   "take 2 items")
}

exports["test stop at right branch"] = function(assert) {
  var source = concat([1, 2, 3], [4, 5])
  var input = take(4, source)

  assert.deepEqual(into(input), [1, 2, 3, 4, END],
                   "take 4 items")
}
