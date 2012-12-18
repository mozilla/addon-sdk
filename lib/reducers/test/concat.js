"use strict";

var test = require("./util/test")
var concat = require("../concat")
var into = require("../into")
var delay = require("../delay")
var capture = require("../capture")

exports["test concat"] = function(assert) {
  var actual = concat([ 1 ], [ 2, 3 ], [ 4, 5, 6 ])

  assert.deepEqual(into(actual),
                   [ 1, 2, 3, 4, 5, 6 ],
                   "reducers were joined")
  assert.deepEqual(into(actual),
                   [ 1, 2, 3, 4, 5, 6 ],
                   "can be re-reduced")
}

exports["test concat empty streams"] = function(assert) {
  var actual = concat([], [])

  assert.deepEqual(into(actual), [], "concat on empty sequences is empty")
}

exports["test concat empty"] = function(assert) {
  var actual = concat([1, 2], [])

  assert.deepEqual(into(actual), [ 1, 2 ], "concat with empty returns same")
}

exports["test concat to empty"] = function(assert) {
  var actual = concat([], [3, 4])

  assert.deepEqual(into(actual), [ 3, 4 ], "concat to empty returns same")
}

exports["test concat many streams"] = function(assert) {
  var actual = concat([1, 2], [], ["a", "b"], [])

  assert.deepEqual(into(actual), [ 1, 2, "a", "b" ], "many concats work")
}

exports["test concat sync & async streams"] = test(function(assert) {
  var async = delay([3, 2, 1])
  var actual = concat(concat(async, []),
                      async,
                      ["a", "b"])

  assert(actual, [3, 2, 1, 3, 2, 1, "a", "b"], "concat sync async works")
})

exports["test concat & reconcat"] = test(function(assert) {
  var async = delay([2, 1])
  var stream = concat(async, ["a", "b"])
  var actual = concat(stream, ["||"], stream)

  assert(actual, [2, 1, "a", "b", "||", 2, 1, "a", "b"], "concat reconcat")
})

exports["test map broken stream"] = test(function(assert) {
  var boom = Error("Boom!")
  var async = delay(concat([3, 2, 1], boom))
  var concated = concat([">"], async, [1, 2], async)
  var actual = capture(concated, function(error) { return error.message })

  assert(actual, [">", 3, 2, 1, boom.message], "test concat on broken stream")
})

exports["test concat error and sequence"] = test(function(assert) {
  var boom = Error("Boom!")
  var concated = concat(boom, [ 1, 2, 3 ])
  var actual = capture(concated, function(error) {
    return error.message
  })


  assert(actual, [boom.message], "sequence has an error")
})

exports["test concat sequence & error"] = test(function(assert) {
  var boom = Error("Boom!")
  var concated = concat([ 1, 2, 3 ], boom)
  var actual = capture(concated, function(error) {
    return error.message
  })


  assert(actual, [1, 2, 3, boom.message], "sequence has an error")
})

exports["test concat sequence & error & sequence"] = test(function(assert) {
  var boom = Error("Boom!")
  var concated = concat([ 1, 2, 3 ], boom, [ 4, 5, 6 ])
  var actual = capture(concated, function(error) {
    return error.message
  })


  assert(actual, [1, 2, 3, boom.message], "sequence has an error")
})

if (module == require.main)
  require("test").run(exports)
