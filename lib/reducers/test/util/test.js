"use strict";

var reduce = require("reducible/reduce")
var isError = require("reducible/is-error")
var end = require("reducible/end")
var isReduced = require("reducible/is-reduced")

function test(unit) {
  return function(assertions, done) {
    function assert(actual, expected, comment) {
      var values = []
      reduce(actual, function(actual) {
        if (actual === end) {
          assert.deepEqual(values, expected, comment)
          done()
        } else if (isError(actual)) {
          assert.deepEqual({ values: values, error: actual }, expected, comment)
          done()
        } else if (isReduced(actual)) {
          return actual
        } else {
          values.push(actual)
        }
        return actual
      })
    }

    for (var key in assertions) assert[key] = assertions[key].bind(assertions)

    unit(assert)
  }
}

module.exports = test
