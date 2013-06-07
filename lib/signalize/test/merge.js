"use strict";

var core = require("../core")
var merge = core.merge
var concat = core.concat
var take = core.take
var END = core.END
var STOP = core.STOP
var into = require("./util").into

exports["test merge"] = function(assert) {
  var source = [[1], [2, 3], [4, 5, 6]]
  var input = merge(source)

  assert.deepEqual(into(input), [1, 2, 3, 4, 5, 6, END],
                   "merge signals")

  assert.deepEqual(into(input), [1, 2, 3, 4, 5, 6, END],
                   "can be re-spawned")

  assert.deepEqual(source, [[1], [2, 3], [4, 5, 6]],
                   "no changes to a source")
}

exports["test merge stream of empty streams"] = function(assert) {
  var input = merge([[], []])

  assert.deepEqual(into(input), [END],
                   "merge of empty signals is empty")
}

exports["test merge empty & non-empty"] = function(assert) {
  var input = merge([[], [1, 2], []])

  assert.deepEqual(into(input), [1, 2, END],
                   "merge with empties is non-empty")
}

exports["test merge flattened"] = function(assert) {
  var source = merge([[1, 2], ["a", "b"]])
  var input = merge([[">"], source, []])

  assert.deepEqual(into(input), [">", 1, 2, "a", "b", END],
                   "re-merge works")
}

exports["test merge with broken"] = function(assert) {
  var boom = Error("Boom!")
  var source = concat([3, 2, 1], boom)
  var input = merge([[">"], source, [1, 2]])

  assert.deepEqual(into(input), [">", 3, 2, 1, boom, 1, 2, END],
                   "errors propagate")
}
