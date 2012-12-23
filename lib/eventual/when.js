"use strict";

var method = require("method")
var when = method("when")

when.define(function(value, onRealize) {
  return typeof(onRealize) === "function" ? onRealize(value) : value
})
when.define(Error, function(error, onRealize, onError) {
  return typeof(onError) === "function" ? onError(error) : error
})

module.exports = when
