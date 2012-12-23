"use strict";

var watchers = require("../watchers")
var watch = require("../watch")
var unwatch = require("../unwatch")

exports["test watchers"] = function(assert) {
  assert.throws(function() {
    watchers({})
  }, "object does not implements watchers")
}

exports["test watch / unwatch"] = function(assert) {
  var Watchable = function Watchable() { this.watchers = [] }
  watchers.define(Watchable, function(value) { return value.watchers })

  function watcher1() {}
  function watcher2() {}

  var watchable = new Watchable()

  watch(watchable, watcher1)
  assert.equal(watchers(watchable).indexOf(watcher1), 0, "watcher registered")
  assert.equal(watchers(watchable).length, 1, "single watcher is registered")

  watch(watchable, watcher1)
  assert.equal(watchers(watchable).length, 1, "watcher is registered only once")

  watch(watchable, watcher2)
  assert.equal(watchers(watchable).indexOf(watcher2), 1, "watcher registered")
  assert.equal(watchers(watchable).length, 2, "single watcher is registered")

  watch(watchable, watcher1)
  watch(watchable, watcher2)
  assert.equal(watchers(watchable).length, 2, "watcher is registered only once")


  unwatch(watchable, watcher1)
  assert.equal(watchers(watchable).indexOf(watcher1), -1, "watcher unregistered")
  assert.equal(watchers(watchable).length, 1, "watcher unregistered")


  watch(watchable, watcher1)
  assert.equal(watchers(watchable).indexOf(watcher1), 1,
               "watcher re-registered")
  assert.equal(watchers(watchable).indexOf(watcher2), 0,
               "watcher remains registered")
  assert.equal(watchers(watchable).length, 2, "both watchers are registered")

  unwatch(watchable, watcher2)
  assert.equal(watchers(watchable).indexOf(watcher2), -1, "watcher unregistered")
  assert.equal(watchers(watchable).length, 1, "other watcher remains")


  unwatch(watchable, watcher1)

  assert.equal(watchers(watchable).length, 0, "both watchers are unregistered")
}

exports["test custom watchable implementation"] = function(assert) {
  var Type = function Type() { }

  watchers.define(Type, function(value) {
    var listeners = value._listeners
    return !listeners ? [] :
           typeof(listeners) === "function" ? [ listeners ] :
           listeners.slice(0)
  })
  watch.define(Type, function(value, listener) {
    var listeners = value._listeners
    if (typeof(listeners) === "undefined")
      value._listeners = listener
    else if (typeof(listeners) === "function")
      value._listeners = [value._listeners, listener]
    else
      listeners.push(listener)
  })
  unwatch.define(Type, function(value, listener) {
    var listeners = value._listeners
    var index = -1
    if (typeof(listeners) === "function") {
      if (listeners === listener) value._listeners = void(0)
    } else if (listeners && ~(index = listeners.indexOf(listener))) {
      if (listeners.length === 2) {
        value._listeners = index === 0 ? listeners[1] : listeners[0]
      } else {
        listeners.splice(index, 1)
      }
    }

    return value
  })

  var W = new Type()
  var w1 = function w1() {}
  var w2 = function w2() {}

  assert.notEqual(watchers(W), watchers(W), "each call returns copy")
  assert.deepEqual(watchers(W), [], "no listeres registered yet")

  watch(W, w1)

  assert.equal(W._listeners, w1, "listener was registered")
  assert.deepEqual(watchers(W), [w1], "listener shows up in watchers")

  unwatch(W, w2)

  assert.equal(W._listeners, w1, "listener remains registered")
  assert.deepEqual(watchers(W), [w1], "listener still shows up in watchers")

  unwatch(W, w1)

  assert.equal(W._listeners, void(0), "listener is unregistered")
  assert.deepEqual(watchers(W), [], "listener is no longer in watchers")

  watch(W, w2)
  watch(W, w1)

  assert.deepEqual(W._listeners, [ w2, w1 ], "listeners are registered")
  assert.deepEqual(watchers(W), [ w2, w1 ], "listeners are in watchers")

  unwatch(W, w1)

  assert.equal(W._listeners, w2, "other listener still registered")
  assert.deepEqual(watchers(W), [ w2 ], "other listener is still in watchers")

  unwatch(W, w2)

  assert.equal(W._listeners, void(0), "listeners are unregistered")
  assert.deepEqual(watchers(W), [], "listeners are no longer in watchers")
}

require("test").run(exports)
