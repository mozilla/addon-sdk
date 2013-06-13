"use strict";

var core = require("../core")
var take = core.take
var END = core.END
var into = require("./util").into


exports["test take"] = function(assert) {
  var input = take(2, [1, 2, 3, 4])

  assert.deepEqual(into(input), [1, 2, END], "picked two items")
  assert.deepEqual(into(input), [1, 2, END], "can be re-reduced same")
}

exports["test take none"] = function(assert) {
  var input = take(0, [1, 2, 3, 4])

  assert.deepEqual(into(input), [END], "picks none on 0")
}

exports["test take all"] = function(assert) {
  var input = take(100, [1, 2, 3, 4])

  assert.deepEqual(into(input), [1, 2, 3, 4, END],
                   "picks all if has less than requested")
}

exports["test take empty"] = function(assert) {
  var input = take(100, [])

  assert.deepEqual(into(input), [END],
                   "nothing to take from empy")
}

exports["test take more than have"] = function(assert) {
  var input = take(5, [1, 2, 3])

  assert.deepEqual(into(input), [1, 2, 3, END],
                   "can't take more then contains")
}

exports["test take falls back to all"] = function(assert) {
  var input = take(Infinity, [1, 2, 3])

  assert.deepEqual(into(input), [1, 2, 3, END],
                   "taking infinity takes as much as it has")
}

exports["test take may be given 0"] = function(assert) {
  var input = take(0, [1, 2, 3])

  assert.deepEqual(into(input), [END],
                   "taking zero returns equivalent")
}

exports["test take & error"] = function(assert) {
  var boom = Error("Boom!")
  var input = take(3, [3, 2, 1, boom])

  assert.deepEqual(into(input), [3, 2, 1, END],
                   "errors that are not reached are ignored")
}

exports["test error propagation"] = function(assert) {
  var boom = Error("Boom!")
  var input = take(5, [3, 2, 1, boom, 0, boom])

  assert.deepEqual(into(input), [3, 2, 1, boom, 0, boom, END],
                   "errors with-in take range propagate")
}
