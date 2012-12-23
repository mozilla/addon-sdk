"use strict";

var isPending = require("../is")
var await = require("../await")
var deliver = require("../deliver")

var builtins = [
  { a: 1 },
  [ 'b', 2 ],
  'hello world',
  5,
  /foo/,
  function bar() {},
  Date(),
  undefined,
  null,
  true,
  false
]

exports["test if built-ins are pending"] = function(assert) {
  assert.ok(builtins.every(function(expected) {
    return !isPending(expected)
  }), "non of the built-in values are pending")
}

exports["test if built-ins resolve to themself"] = function(assert) {
  var assertions = builtins.forEach(function(value) {
    await(value, function(result) {
      assert.equal(value, result, value + " resolves to itself")
    })
  })
}

exports["test custom pending type"] = function(assert) {
  function Pending() {
    this._result = this
    this._pending = true
    this._listeners = []
  }
  isPending.define(Pending, function(value) {
    return value._pending
  })

  await.define(Pending, function(value, handler) {
    if (!isPending(value)) handler(value._result)
    else if (!~value._listeners.indexOf(handler)) value._listeners.push(handler)
  })

  deliver.define(Pending, function(value, result) {
    // Ignore delivery for no longer pending values, or
    // if value delivery is already in progress.
    if (isPending(value) && value._result === value) {
      // Empty listeres array to allow registration of new listeners
      // in side effect to dispatch, in order to guarantee FIFO order.
      var count = 0
      var index = 0
      var listeners
      value._result = result
      while (index <= count) {
        if (index === count) {
          listeners = value._listeners.splice(0)
          count = listeners.length
          index = 0
          if (count === index) {
            value._pending = false
            index = index + 1
          }
        } else {
          listeners[index](result)
          index = index + 1
        }
      }
    }
  })

  var p = new Pending()
  var expected = {}
  var messages = []

  assert.ok(isPending(p), "Pending instances are pending")

  var listener1 = function(actual) {
    assert.equal(actual, expected, "listener#1 passed correct result")
    messages.push(listener1)
  }
  var listener2 = function(actual) {
    assert.equal(actual, expected, "listener#2 passed correct result")
    messages.push(listener2)
  }

  await(p, listener1)
  await(p, listener2)

  deliver(p, expected)

  assert.deepEqual(messages, [ listener1, listener2 ],
                   "listeres invoked in FIFO order")
}

require("test").run(exports)
