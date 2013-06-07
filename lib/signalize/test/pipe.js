"use strict";

var core = require("../core")
var spawn = core.spawn
var END = core.END
var api = require("../pipe")
var emit = api.emit
var pipe = api.pipe
var input = api.input

exports["test emit items yield on pipe input"] = function(assert) {
  var port = pipe()
  var actual = []
  spawn(input(port), function(value) {
    actual.push(value)
  })

  assert.deepEqual(actual, [], "empty so far")

  emit(port, 1)

  assert.deepEqual(actual, [1], "1st item was yield")

  emit(port, 2)

  assert.deepEqual(actual, [1, 2], "2nd item was yield")

  emit(port, END)

  assert.deepEqual(actual, [1, 2, END], "3rd item was yield")
}

exports["test return of yield returned by emit"] = function(assert) {
  var port = pipe()
  var actual = []
  spawn(input(port), function(value) {
    actual.push(value)
    return actual.slice(0)
  })

  assert.deepEqual(actual, [], "empty so far")
  assert.deepEqual(emit(port, 1), [1], "1st back")
  assert.deepEqual(actual, [1], "1st item was yield")
  assert.deepEqual(emit(port, 2), [1, 2], "2nd back")
  assert.deepEqual(actual, [1, 2], "2nd item was yield")
  assert.deepEqual(emit(port, END), [1, 2, END], "3rd back")
  assert.deepEqual(actual, [1, 2, END], "3rd item was yield")
}