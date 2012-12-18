"use strict";

var watchers = require("watchables/watchers")
var watch = require("watchables/watch")
var await = require("pending/await")
var isPending = require("pending/is")
var deliver = require("./deliver")
var when = require("./when")

// Internal utility function returns true if given value is of error type,
// otherwise returns false.
var isError = (function() {
  var stringy = Object.prototype.toString
  var error = stringy.call(Error.prototype)
  return function isError(value) {
    return stringy.call(value) === error
  }
})()

// Internal utility, identity function. Returns whatever is given to it.
function identity(value) { return value }

// Internal utility, decorator function that wraps given function into
// try / catch and returns thrown exception in case when exception is
// thrown.
function attempt(f) {
  return function effort(value) {
    try { return f(value) }
    catch (error) { return error }
  }
}


// Define property names used by an `Eventual` type. Names are prefixed via
// `module.id` to avoid name conflicts.
var observers = "observers@" + module.id
var result = "value@" + module.id
var pending = "pending@" + module.id


function Eventual() {
  /**
  Data type representing eventual value, that can be observed and delivered.
  Type implements `watchable`, `pending` and `eventual` abstractions, where
  first two are defined in an external libraries.
  **/
  this[observers] = []
  this[result] = this
  this[pending] = true
}
// Expose property names via type static properties so that it's easier
// to refer to them while debugging.
Eventual.observers = observers
Eventual.result = result
Eventual.pending = pending

watchers.define(Eventual, function(value) {
  return value[observers]
})
// Eventual values considered to be pending until the are deliver by calling
// `deliver`. Internal `pending` property is used to identify weather value
// is being watched or not.
isPending.define(Eventual, function(value) {
  return value[pending]
})
// Eventual type implements await function of pending abstraction, to enable
// observation of value delivery.
await.define(Eventual, function(value, observer) {
  if (isPending(value)) watch(value, observer)
  else observer(value[result])
})

// Eventual implements `deliver` function of pending abstraction, to enable
// fulfillment of eventual values. Eventual value can be delivered only once,
// which will transition it from pending state to non-pending state. All
// further deliveries are ignored. It's also guaranteed that all the registered
// observers will be invoked in FIFO order.
deliver.define(Eventual, function(value, data) {
  // Ignore delivery if value is no longer pending, or if it's in a process of
  // delivery (in this case eventual[result] is set to value other than
  // eventual itself). Also ignore if data deliver is value itself.
  if (value !== data && isPending(value) && value[result] === value) {
    var count = 0
    var index = 0
    var delivering = true
    var observers = void(0)
    // Set eventual value result to passed data value that also marks value
    // as delivery in progress. This way all the `deliver` calls is side
    // effect to this will be ignored. Note: value should still remain pending
    // so that new observers could be registered instead of being called
    // immediately, otherwise it breaks FIFO order.
    value[result] = data
    while (delivering) {
      // If current batch of observers is exhausted, splice a new batch
      // and continue delivery. New batch is created only if new observers
      // are registered in side effect to this call of deliver.
      if (index === count) {
        observers = watchers(value).splice(0)
        count = observers.length
        index = 0
        // If new observers have not being registered mark value as no longer
        // pending and finish delivering.
        if (count === index) {
          value[pending] = false
          delivering = false
        }
      }
      // Register await handlers on given result, is it may be eventual /
      // pending itself. Delivering eventual will cause delivery of the
      // delivered eventual's delivery value, whenever that would be.
      else {
        await(data, observers[index])
        index = index + 1
      }
    }
  }
})

// Eventual implements `when` polymorphic function that is part of it's own
// abstraction. It takes `value` `onFulfill` & `onError` handlers. In return
// when returns eventual value, that is delivered return value of the handler
// that is invoked depending on the given values delivery. If deliver value
// is of error type error handler is invoked. If value is delivered with other
// non-pending value that is not of error type `onFulfill` handlers is invoked
// with it. If pending value is delivered then it's value will be delivered
// it's result whenever that would be. This will cause both value and error
// propagation.
when.define(Eventual, function(value, onRealize, onError) {
  // Create eventual value for a return value.
  var delivered = false
  var eventual = void(0)
  var result = void(0)
  // Wrap handlers into attempt decorator function, so that in case of
  // exception thrown error is returned causing error propagation. If handler
  // is missing identity function is used instead to propagate value / error.
  var realize = onRealize ? attempt(onRealize) : identity
  var error = onError ? attempt(onError) : identity
  // Wait for pending value to be delivered.
  await(value, function onDeliver(data) {
    // Once value is delivered invoke appropriate handler, and deliver it
    // to a resulting eventual value.
    result = isError(data) ? error(data)
                           : realize(data)

    // If outer function is already returned and has created eventual
    // for it's result deliver it. Otherwise (if await called observer
    // in same synchronously) mark result delivered.
    if (eventual) deliver(eventual, result)
    else delivered = true
  })

  // If result is delivered already return it, otherwise create eventual
  // value for the result and return that.
  return delivered ? result : (eventual = new Eventual())
})

module.exports = Eventual
