"use strict";

var when = require("./when")
var unbind = Function.call.bind(Function.bind, Function.call)
var slice = Array.slice || unbind(Array.prototype.slice)

// Utility function takes array of eventual values and return single
// eventual value that is delivered an array of delivery values for
// those eventuals. If any of the eventuals is delivered error that
// error is delivered instead.
var group = function group(eventuals) {
  return slice(eventuals).reduce(function(eventuals, eventual) {
    return when(eventual, function(value) {
      return when(eventuals, function(values) {
        values.push(value)
        return values
      })
    })
  }, [])
}

module.exports = group
