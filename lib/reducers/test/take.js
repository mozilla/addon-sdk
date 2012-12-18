"use strict";

var test = require("./util/test")
var concat = require("../concat")
var delay = require("../delay")
var capture = require("../capture")

var into = require("../into")
var take = require("../take")


exports["test take"] = function(assert) {
  var actual = take([ 1, 2, 3, 4 ], 2)

  assert.deepEqual(into(actual), [ 1, 2 ], "picked two items")
  assert.deepEqual(into(actual), [ 1, 2 ], "can be re-reduced same")
}

exports["test take none"] = function(assert) {
  var actual = take([ 1, 2, 3, 4 ], 0)

  assert.deepEqual(into(actual), [], "picks none on 0")
}

exports["test take all"] = function(assert) {
  var actual = take([ 1, 2, 3, 4 ], 100)

  assert.deepEqual(into(actual), [ 1, 2, 3, 4 ],
                   "picks all if has less than requested")
}

exports["test take empty"] = test(function(assert) {
  var actual = take([], 100)

  assert(actual, [], "nothing to take from empy")
})

exports["test take more than have"] = test(function(assert) {
  var actual = take([1, 2, 3], 5)

  assert(actual, [1, 2, 3], "can't take more then contains")
})

exports["test take falls back to all"] = test(function(assert) {
  var actual = take([1, 2, 3], Infinity)

  assert(actual, [1, 2, 3], "taking infinity takes as much as it has")
})

exports["test take may be given 0"] = test(function(assert) {
  var actual = take([1, 2, 3], 0)

  assert(actual, [], "taking zero returns equivalent")
})

exports["test take on async stream"] = test(function(assert) {
  var delayed = delay([5, 4, 3, 2, 1])
  var actual = take(delayed, 3)

  assert(actual, [5, 4, 3], "works with async streams")
})

exports["test take before error"] = test(function(assert) {
  var boom = Error("Boom!")
  var delayed = delay(concat([3, 2, 1], boom))
  var recovered = capture(delayed, function(e) { return e.message })
  var actual = take(recovered, 3)

  assert(actual, [3, 2, 1], "errors that are not reached are ignored")
})

exports["test error propagation"] = test(function(assert) {
  var boom = Error("Boom!")
  var delayed = delay(concat([3, 2, 1], boom))
  var recovered = capture(delayed, function(e) { return e.message })
  var actual = take(recovered, 5)

  assert(actual, [3, 2, 1, boom.message], "errors with-in take range propagate")
})

if (module == require.main)
  require("test").run(exports)
