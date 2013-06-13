"use strict";

var core = require("../core")
var signal = core.signal
var drop = core.drop
var take = core.take
var END = core.END
var STOP = core.STOP
var pipes = require("../pipe")
var pipe = pipes.pipe
var send = pipes.emit
var input = pipes.input
var hub = require("../hub").hub
var into = require("./util").into

exports["test hub propagates"] = function(assert) {
  var port = pipe()
  var source = hub(input(port))

  var actual = into(source)

  assert.deepEqual(actual, [], "there's nothing there yet")

  send(port, 1)
  send(port, 2)
  send(port, 3)
  send(port, END)


  assert.deepEqual(actual, [1, 2, 3, END], "all value were propagated")
}

exports["test multiple consumers"] = function(assert) {
  var port = pipe()
  var source = hub(input(port))

  var p1 = into(source)
  var p2 = into(source)


  send(port, 1)

  var p3 = into(source)

  send(port, 2)
  send(port, 3)

  var p4 = into(source)

  send(port, END)

  assert.deepEqual(p1, [1, 2, 3, END], "first got all items")
  assert.deepEqual(p2, [1, 2, 3, END], "second got all items")
  assert.deepEqual(p3, [2, 3, END], "third missed first item")
}

exports["test hub propagates last STOP"] = function(assert) {
  var port = pipe()
  var source = hub(input(port))
  var first = into(take(2, source))

  assert.notEqual(send(port, 1), STOP, "active")

  var second = into(take(3, source))

  assert.notEqual(send(port, 2), STOP, "active")
  assert.notEqual(send(port, 3), STOP, "active")
  assert.equal(send(port, 4), STOP, "stops on last stop")


  assert.deepEqual(first, [1, 2, END], "first two propageted")
  assert.deepEqual(second, [2, 3, 4, END], "last three propageted")
}

exports["test END drains consumers"] = function(assert) {
  var next = null
  var input = signal(function(emit) { next = emit })
  var source = hub(input)
  var first = into(source)

  assert.notEqual(next(1), STOP, "active")

  var second = into(source)

  assert.notEqual(next(2), STOP, "active")
  assert.notEqual(next(3), STOP, "active")
  assert.notEqual(next(END), STOP, "active")

  assert.equal(next(4), STOP, "Stops after END is send")

  assert.deepEqual(first, [1, 2, 3, END], "all values propageted")
  assert.deepEqual(second, [2, 3, END], "rest propageted")
}

exports["test hub re-spawns source"] = function(assert) {
  var users = []
  var input = signal(function(next) {
    users.push(next)
  })
  var source = hub(input)

  assert.deepEqual(users, [], "no users until source is spawned")

  var first = into(source)

  assert.equal(users.length, 1, "user added on first spawns")
  var next = users.shift()

  assert.notEqual(next(1), STOP, "active")

  var second = into(source)
  assert.equal(users.length, 0, "user not added on subsequent spawns")

  assert.notEqual(next(2), STOP, "active")
  assert.notEqual(next(3), STOP, "active")
  assert.notEqual(next(END), STOP, "active")

  assert.equal(next(4), STOP, "Stops after END is send")

  var third = into(source)

  assert.equal(users.length, 1, "hub re-spawns signal afte new user")
  var next = users.shift()
  assert.notEqual(next(5), STOP, "Stops after END is send")

  assert.deepEqual(first, [1, 2, 3, END], "all values propageted")
  assert.deepEqual(second, [2, 3, END], "rest propageted")
  assert.deepEqual(third, [5], "task restarted")
}

exports["test hub with non signals"] = function(assert) {
  assert.deepEqual(into(hub(null)), [null, END],
                   "null can be passed through hub")
  assert.deepEqual(into(hub()), [void(0), END],
                   "undefined can be passed through hub")


  var array = [1, 2, 3]
  var source = hub(array)

  assert.deepEqual(into(source), [1, 2, 3, END], "first user get's all items")
  assert.deepEqual(into(source), [1, 2, 3, END], "second user get's all items")
  assert.deepEqual(array, [1, 2, 3], "array has not changed")
}

