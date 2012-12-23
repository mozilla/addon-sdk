"use strict";

var test = require("./util/test")

var concat = require("../concat")
var into = require("../into")
var delay = require("../delay")
var capture = require("../capture")
var map = require("../map")
var expand = require("../expand")
var take = require("../take")
var merge = require("../merge")
var into = require("../into")

exports["test merge"] = function(assert) {
  var source = [ [ 1 ], [ 2, 3 ], [ 4, 5, 6 ] ]
  var actual = merge(source)

  assert.deepEqual(into(actual),
                   [ 1, 2, 3, 4, 5, 6 ],
                   "merge reducers")
  assert.deepEqual(into(actual),
                   [ 1, 2, 3, 4, 5, 6 ],
                   "can be re-reduced")
  assert.deepEqual(source, [ [ 1 ], [ 2, 3 ], [ 4, 5, 6 ] ],
                   "no changes to a source")
}

exports["test merge stream of empty streams"] = test(function(assert) {
  var actual = merge([[], []])

  assert(actual, [], "merge of empty streams is empty")
})

exports["test merge empty & non-empty"] = test(function(assert) {
  var actual = merge([[], [1, 2], []])

  assert(actual, [1, 2], "merge with empties is non-empty")
})

exports["test merge flattened"] = test(function(assert) {
  var stream = merge([[1, 2], ["a", "b"]])
  var actual = merge([[">"], stream, []])

  assert(actual, [">", 1, 2, "a", "b"], "flattening flattened works")
})

exports["test merge sync & async streams"] = test(function(assert) {
  var async = delay([3, 2, 1])
  var actual = merge([async, ["|"], async, ["a", "b"], []])

  assert(actual, ["|", "a", "b", 3, 3, 2, 2, 1, 1], "orders by time")
})

exports["test merge with broken stream"] = test(function(assert) {
  var boom = Error("Boom!")
  var async = delay(concat([3, 2, 1], boom))
  var flattened = merge([[">"], async, [1, 2]])
  var actual = capture(flattened, function(error) {
    return error.message
  })

  assert(actual, [">", 1, 2, 3, 2, 1, boom.message], "errors propagate")
})

exports["test merge async stream of streams"] = test(function(assert) {
  var async = delay([3, 2, 1])
  var actual = merge([[], [1, 2], async, ["a", "b"], async])

  assert(actual, [1, 2, "a", "b", 3, 3, 2, 2, 1, 1], "mixed stream works")
})


if (module == require.main)
  require("test").run(exports)
