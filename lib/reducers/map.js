"use strict";

var reducer = require("./reducer")

var map = reducer(function map(f, next, value, result) {
  /**
  Returns transformed version of given `source` where each item of it
  is mapped using `f`.

  ## Example

  var data = [{ name: "foo" }, { name: "bar" }]
  var names = map(data, function(value) { return value.name })
  print(names) // => < "foo" "bar" >
  **/
  next(f(value), result)
})

module.exports = map
