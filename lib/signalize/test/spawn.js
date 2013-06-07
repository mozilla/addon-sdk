"use strict";


var core = require("../core")
var spawn = core.spawn
var empty = core.empty
var constant = core.constant
var END = core.END

exports["test null is singular finite"] = function(assert) {
  var into = []
  spawn(null, function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [null, END],
                   "null is singular & finite")
}

exports["test undefined is singular finite"] = function(assert) {
  var into = []
  spawn(void(0), function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [void(0), END],
                   "undefined is singular & finite")
}

exports["test number is singular finite"] = function(assert) {
  var into = []
  spawn(4, function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [4, END],
                   "number is singular & finite")
}

exports["test array is finite signal of it's elements"] = function(assert) {
  var into = []
  spawn([1, 2, 3], function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [1, 2, 3, END],
                   "yields all elements and ends")
}

exports["test string is finite signal of it's chars"] = function(assert) {
  var into = []
  spawn("hello", function(value) {
    into.push(value)
  })

  assert.deepEqual(into, ["h", "e", "l", "l", "o", END],
                   "yields all chars and ends")
}

exports["test empty array is empty signal"] = function(assert) {
  var into = []
  spawn([], function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [END],
                   "empty array is empty")
}


exports["test empty string is empty signal"] = function(assert) {
  var into = []
  spawn("", function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [END],
                   "empty string is empty")
}


exports["test sigle element array is singular"] = function(assert) {
  var into = []
  spawn([1], function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [1, END],
                   "single element arry is singular")
}

exports["test sigle char string singular"] = function(assert) {
  var into = []
  spawn("a", function(value) {
    into.push(value)
  })

  assert.deepEqual(into, ["a", END],
                   "yields only char")
}

exports["test `empty` is empty signal"] = function(assert) {
  var into = []
  spawn(empty, function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [END],
                   "`empty` is empty signal")
}

exports["test `empty` is callable"] = function(assert) {
  var into = []
  spawn(empty(), function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [END],
                   "`empty()` is empty signal")
}


exports["test `constant` is infinite"] = function(assert) {
  var into = []
  spawn(constant(1), function(value) {
    into.push(value)
  })

  assert.deepEqual(into, [1],
                   "`constant(x)` is infinite")
}
