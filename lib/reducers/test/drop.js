"use strict";

var test = require("./util/test")
var lazy = require("./util/lazy")

var into = require("../into")
var drop = require("../drop")
var delay = require("../delay")
var concat = require("../concat")
var capture = require("../capture")


exports["test drop"] = function(assert) {
  var actual = drop([ 1, 2, 3, 4 ], 2)

  assert.deepEqual(into(actual), [ 3, 4 ], "skipped two items")
  assert.deepEqual(into(actual), [ 3, 4 ], "can be re-reduced same")
}

exports["test drop none"] = function(assert) {
  var actual = drop([ 1, 2, 3, 4 ], 0)

  assert.deepEqual(into(actual), [ 1, 2, 3, 4 ], "skips none on 0")
}

exports["test drop all"] = function(assert) {
  var actual = drop([ 1, 2, 3, 4 ], 100)

  assert.deepEqual(into(actual), [],
                   "skips all if has less than requested")
}

exports["test drop empty"] = test(function(assert) {
  var actual = drop([], 100)

  assert(actual, [], "drop on empty is empty")
})



exports["test drop on sync stream"] = test(function(assert) {
  var actual = drop([1, 2, 3, 4], 3)

  assert(actual, [4], "dropped all except last")
})

exports["test drop falls back to 1"] = test(function(assert) {
  var actual = drop([1, 2, 3, 4], Infinity)

  assert(actual, [], "dropped every item")
})

exports["test drop can take 0"] = test(function(assert) {
  var actual = drop([1, 2, 3, 4], 0)

  assert(actual, [1, 2, 3, 4], "dropped none")
})

exports["test drop more than have"] = test(function(assert) {
  var actual = drop([1, 2, 3, 4], 5)

  assert(actual, [], "dropped more the contained")
})

exports["test drop of async stream"] = test(function(assert) {
  var actual = drop(delay([5, 4, 3, 2, 1]), 2)

  assert(actual, [3, 2, 1], "drop 2 from async")
})

exports["test drop on stream with error"] = test(function(assert) {
  var boom = Error("Boom!")
  var dropped = drop(delay(concat([4, 3, 2, 1], boom)), 2)
  var actual = capture(dropped, function(error) { return error.message })

  assert(actual, [2, 1, boom.message], "dropped on broken stream")
})

exports["test drop on stream with error in head"] = test(function(assert) {
  var boom = Error("Boom!")
  var dropped = drop(delay(concat(boom, [4, 3, 2, 1])), 2)
  var actual = capture(dropped, function(error) { return error.message })

  assert(actual, [boom.message], "attempt to drop on early errors")
})


if (require.main === module)
  require("test").run(exports)
