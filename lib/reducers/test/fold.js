"use strict";

var fold = require("../fold")
var reduced = require("reducible/reduced")
var into = require("../into")


exports["test reduce"] = function(assert) {
  var result = fold([ 1, 2, 3 ], function(value, state) {
    return state + value
  }, 0)

  assert.equal(result, 6, "value is accumulated")
}

exports["test reduced early"] = function(assert) {
  var result = fold([ 1, 2, 3 ], function(value, state) {
    return reduced("nope")
  }, 0)

  assert.equal(result, "nope", "early reduce value is accumulated")
}

exports["test fold errored"] = function(assert) {
  var boom = Error("Boom!")
  var result = fold([ 1, 2, boom ], function(value, state) {
    return state + value
  }, 0)

  assert.equal(result, boom, "errors propagate")
}

exports["test fold late error"] = function(assert) {
  var boom = Error("Boom!")
  var result = fold([ 1, 2, boom ], function(value, state) {
    return reduced("Wheuh")
  }, 0)

  assert.equal(result, "Wheuh", "late errors are irrelevant")
}

exports["test fold null"] = function(assert) {
  var result = fold(null, function(value, state) {
    return state + value
  }, 0)

  assert.equal(result, 0, "null reduces to initial")
}

exports["test fold void"] = function(assert) {
  var result = fold(void(0), function(value, state) {
    return state + value
  }, 0)

  assert.equal(result, 0, "void reduces to initial")
}

exports["test fold empty"] = function(assert) {
  var result = fold([], function(value, state) {
    return state + value
  }, 0)

  assert.equal(result, 0, "[] reduces to initial")
}

exports["test fold string"] = function(assert) {
  var result = fold("world", function(value, state) {
    return state + value
  }, "hello ")

  assert.equal(result, "hello world", "string is equivalent of array of itself")
}

exports["test fold number"] = function(assert) {
  var result = fold(7, function(value, state) {
    return state + value
  }, 10)

  assert.equal(result, 17, "number is equivalent of array of itself")
}

exports["test fold object"] = function(assert) {
  var result = fold({}, function(state, value) {
    return state + value
  }, "hello ")

  assert.equal(result, "hello " + {},
               "object is equivalent of array of itself")
}

exports["test fold object"] = function(assert) {
  var boom = Error("Boom!")
  var result = fold(boom, function(value, state) {
    return state + value
  }, "hello ")

  assert.equal(result, boom, "error is errored collection")
}

exports["test reducer thorws"] = function(assert) {
  var error = Error("I hate 2")
  var result = fold([ 1, 2, 3 ], function(value, state) {
    if (value === 2) throw error
    return state + value
  }, 0)

  assert.deepEqual(result, error,  "Thrown erros in reduce error results")
}

if (require.main === module)
  require("test").run(exports)
