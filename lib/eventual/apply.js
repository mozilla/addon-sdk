"use strict";

var when = require("./when")
var group = require("./group")

// Function can be use with eventual values, it treats each of it's arguments
// as eventual value and returns a fresh one in return. Once all of the
// arguments are delivered first one is invoked with rest and return value
// is delivered to the resulting eventual. If everything happens synchronously
// actual value is returned.
var apply = function apply(f, params) {
  var eventuals = params.slice(0)
  eventuals.unshift(f)
  return when(group(eventuals), function(values) {
    var f = values.shift()
    return f.apply(f, values)
  })
}

module.exports = apply
