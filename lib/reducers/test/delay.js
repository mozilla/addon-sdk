"use strict";

var test = require("./util/test")
var concat = require("../concat")
var into = require("../into")
var delay = require("../delay")
var capture = require("../capture")
var lazy = require("./util/lazy")

exports["test delay empty"]  = test(function(assert) {
  var async = false
  var actual = concat(delay([]),
                      lazy(function() { return async }))

  assert(actual, [true], "delay makes things async")
  async = true
})

exports["test sequence of numbers"] = test(function(assert) {
  var async = false
  var actual = concat(delay([1, 2, 3, 4]),
                      lazy(function() { return async }))

  assert(actual, [1, 2, 3, 4, true], "dealy made stream async")
  async = true
})

if (module == require.main)
  require("test").run(exports)
