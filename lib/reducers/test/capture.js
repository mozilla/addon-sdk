"use strict";

var test = require("./util/test")
var concat = require("../concat")
var into = require("../into")
var delay = require("../delay")
var capture = require("../capture")
var map = require("../map")
var expand = require("../expand")
var take = require("../take")
var lazy = require("./util/lazy")

exports["test capture empty stream"] = test(function(assert) {
  var called = 0
  var captured = capture([], function final() {
    called = called + 1
  })
  var actual = concat(captured, lazy(function() { return called }))


  assert(actual, [0], "error handler was not called")
})

exports["test capture with a non-empty stream"] = test(function(assert) {
  var actual = capture([1, 2], function() { return [3, 4] })

  assert(actual, [1, 2], "error handler has is not called")
})

exports["test error recovery"] = test(function(assert) {
  var boom = Error("Boom!")
  var actual = capture(boom, function catcher(e) {
    return [ "catch", e.message ]
  })

  assert(actual, ["catch", boom.message ], "error handler is called")
})

exports["test errors can be ignored"] = test(function(assert) {
  var boom = Error("Boom!")
  var brax = Error("brax")
  var source = concat(["h", "i"], boom)
  var captured = capture(source, function cacher(e) {
    return [e.message, brax]
  })
  var actual = capture(captured, function(e) {
    return e.message
  })


  assert(actual, ["h", "i", boom.message, brax.message],
                  "recovery code still may leak errors")
})


exports["test capture error every time"] = test(function(assert) {
  var boom = Error("Boom!!")
  var calls = 0
  var reason
  var captured = capture(boom, function(error) {
    calls = calls + 1
    reason = error
    return
  })

  var actual = concat(captured,
                      lazy(function() { return calls }),
                      lazy(function() { return reason.message }),
                      captured,
                      lazy(function() { return calls }),
                      lazy(function() { return reason.message }))


  assert(actual, [1, boom.message, 2, boom.message],
         "error handler is called each time")
})

exports["test substitution is lazy"] = test(function(assert) {
  var calls = 0
  var boom = Error("boom")
  var captured = capture([1, 2, 3, 4, boom], function(error) {
    calls = calls + 1
    return [5, 6, 7]
  })

  var actual = concat(take(captured, 1),
                      lazy(function() { return calls }),
                      captured,
                      lazy(function() { return calls }))

  assert(actual, [
    1,
    0,
    1, 2, 3, 4, 5, 6, 7,
    1
  ], "error handlers only called if that associated section is read")
})


exports["test ignore error"] = test(function(assert) {
  var boom = Error("Boom!")
  var actual = capture([1, 2, 3, boom], function() {})

  assert(actual, [1, 2, 3], "if nothing returned stream is done")
})

if (require.main === module)
  require("test").run(exports)
