"use strict";

var core = require("../core")
var drop = core.drop
var END = core.END
var into = require("./util").into

exports["test drop"] = function(assert) {
  var input = drop(2, [1, 2, 3, 4])

  assert.deepEqual(into(input), [3, 4, END], "skipped two items")
  assert.deepEqual(into(input), [3, 4, END], "can be re-reduced same")
}

exports["test drop none"] = function(assert) {
  var input = drop(0, [1, 2, 3, 4])

  assert.deepEqual(into(input), [1, 2, 3, 4, END], "skips none on 0")
}

exports["test drop all"] = function(assert) {
  var input = drop(100, [1, 2, 3, 4])

  assert.deepEqual(into(input), [END],
                   "skips all if has less than requested")
}

exports["test drop empty"] = function(assert) {
  var input = drop(100, [])

  assert.deepEqual(into(input), [END], "drop on empty is empty")
}



exports["test drop all but last"] = function(assert) {
  var input = drop(3, [1, 2, 3, 4])

  assert.deepEqual(into(input), [4, END], "dropped all except last")
}

exports["test drop infinite number"] = function(assert) {
  var input = drop(Infinity, [1, 2, 3, 4])

  assert.deepEqual(into(input), [END], "dropped every item")
}

exports["test drop 0"] = function(assert) {
  var input = drop(0, [1, 2, 3, 4])

  assert.deepEqual(into(input), [1, 2, 3, 4, END], "dropped none")
}

exports["test drop more than have"] = function(assert) {
  var input = drop(5, [1, 2, 3, 4])

  assert.deepEqual(into(input), [END], "dropped more the contained")
}

exports["test drop with error"] = function(assert) {
  var boom = Error("Boom!")
  var input = drop(2, [4, 3, 2, 1, boom])

  assert.deepEqual(into(input), [2, 1, boom, END], "dropped on broken stream")
}
