"use strict";


// The library for general signal manipulation. Includes `lift` function
// (that supports up to 8 inputs), combinations, filters, and past-dependence.
//
// Signals are time-varying values. Lifted functions are reevaluated whenver
// any of their input signals has an event. Signal events may be of the same
// value as the previous value of the signal. Such signals are useful for
// timing and past-dependence.
//
// Some useful functions for working with time (e.g. setting FPS) and combining
// signals and time (e.g. delaying updates, getting timestamps) can be found in
// the Time library.
//
// Module implements elm API: http://docs.elm-lang.org/library/Signal.elm


var $source = "source@signal"
var $sources = "sources@signal"
var $outputs = "outputs@signal"
var $connect = "connect@signal"
var $disconnect = "disconnect@signal"
var $receive = "receive@signal"
var $error = "error@signal"
var $end = "end@signal"
var $start = "start@signal"
var $stop = "stop@signal"
var $state = "state@signal"
var $pending = "pending@signal"

function outputs(input) { return input[$outputs] }
outputs.toString = function() { return $outputs }
exports.outputs = outputs

function start(input) { input[$start](input) }
start.toString = function() { return $start }
exports.start = start

function stop(input) { input[$stop](input) }
stop.toString = function() { return $stop }
exports.stop = stop

function connect(source, target) { source[$connect](source, target) }
connect.toString = function() { return $connect }
exports.connect = connect

function disconnect(source, target) { source[$disconnect](source, target) }
disconnect.toString = function() { return $disconnect }
exports.disconnect = disconnect

function receive(input, message) { input[$receive](input, message) }
receive.toString = function() { return $receive }
exports.receive = receive

function error(input, message) { input[$error](input, message) }
error.toString = function() { return $error }
exports.error = error

function end(input) { input[$end](input) }
end.toString = function() { return $end }
exports.end = end

function stringify(input) {
  return input.name + "[" + (input[$outputs] || []).map(function(x) { return x.name }) + "]"
}

var stringifier = Object.prototype.toString
function isError(message) {
  return stringifier.call(message) === "[object Error]"
}

function Return(value) {
  if (!(this instanceof Return))
    return new Return(value)

  this.value = value
}
exports.Return = Return

function send(input, message) {
  if (message instanceof Return) {
    input[$receive](input, message.value)
    input[$end](input)
  }
  else if (isError(message)) {
    input[$error](input, message)
  }
  else {
    input[$receive](input, message)
  }
}
exports.send = send

function Break() {}
exports.Break = Break


function Input() {}
exports.Input = Input

// `Input.start` is invoked with an `input` whenever system is
// ready to start receiving values. After this point `input` can
// start sending messages. Generic behavior is to `connect` to
// the `input[$source]` to start receiving messages.
Input.start = function(input) {
  var source = input[$source]
  source[$connect](source, input)
}

// `Input.stop` is invoked with an `input` whenever it needs to
// stop. After this point `input` should stop sending messages.
// Generic `Input` behavior is to `disconnect` from the
// `input[$source]` so no more `messages` will be received.
Input.stop = function(input) {
  var source = input[$source]
  source[$disconnect](source, input)
}

// `Input.connect` is invoked with `input` and `output`. This
// implementation put's `output` to it's `$output` ports to
// delegate received `messages` to it.
Input.connect = function(input, output) {
  var outputs = input[$outputs]
  if (outputs.indexOf(output) < 0) {
    outputs.push(output)
    if (outputs.length === 1)
      input[$start](input)
  }
}

// `Input.disconnect` is invoked with `input` and an `output`
// connected to it. After this point `output` should not longer
// receive messages from the `input`. If it's a last `output`
// `input` will be stopped.
Input.disconnect = function(input, output) {
  var outputs = input[$outputs]
  var index = outputs.indexOf(output)
  if (index >= 0) {
    outputs.splice(index, 1)
    if (outputs.length === 0)
      input[$stop](input)
  }
}

// `Input.Port` creates a message receiver port. `Input` instances support
// `message`, `error`, `end` ports.
Input.Port = function(port) {
  var isError = port === $error
  var isEnd = port === $end
  var isMessage = port === $receive

  // Function will write `message` to a given `input`. This means
  // it will delegeate messages to it's `input[$outputs]` ports.
  return function write(input, message) {
    var outputs = input[$outputs]
    var result = void(0)
    var count = outputs.length
    var index = 0

    // If it is error and there are no connections log an error.
    if (!count && isError) {
      console.error("Unhandled error message", input, message);
    }
    // Note: dispatch loop decreases count or increases index as needed.
    // This makes sure that new connections will not receive messages
    // until next dispatch loop & intentionally so.
    while (index < outputs.length) {
      // Attempt to send a value to a connected `output`. If this is
      // `$end` `port` return `Break` to cause `output` to be
      // disconnected. If any other `port` just deliver a `message`.
      var output = outputs[index]
      try {
        result = isEnd ? output[port](output, input) :
                 output[port](output, message, input)
      }
      catch (reason) {
        // If exception was thrown and `message` was send to `$error`
        // `port` give up and log error.
        if (isError) {
          console.error("Failed to receive an error message",
                        message,
                        reason)
        }
        // If exception was thrown when writing to a different `port`
        // attempt to write to an `$error` `port` of the `output`.
        else {
          try {
            result = output[$error](output, reason, input)
          }
          // If exception is still thrown when writing to an `$error`
          // `port` give up and log `error`.
          catch (error) {
            console.error("Failed to receive message & an error",
                          message,
                          reason,
                          error);
          }
        }
      }

      // If result of sending `message` to an `output` was instance
      // of `Break`, disconnect that `output` so it no longer get's
      // messages. Note `index` is decremented as disconnect will
      // remove it from `outputs`.
      if (result instanceof Break || isEnd) {
        input[$disconnect](input, output)
      }
      // On any other `result` just move to a next output.
      else {
        index = index + 1
      }
    }

    // Once message was written to all outputs update `value` of
    // the input.
    if (isMessage)
      input.value = message

    if (count === 0 && isEnd)
      input[$stop](input)
  }
}

// Inputs have `message`, `error` and `end` ports
Input.receive = Input.Port($receive)
Input.error = Input.Port($error)
Input.end = Input.Port($end)

// Same API functions are saved in the prototype in order to enable
// polymorphic dispatch.
Input.prototype[$start] = Input.start
Input.prototype[$stop] = Input.stop
Input.prototype[$connect] = Input.connect
Input.prototype[$disconnect] = Input.disconnect
Input.prototype[$receive] = Input.receive
Input.prototype[$error] = Input.error
Input.prototype[$end] = Input.end
Input.prototype.toJSON = function() {
  return { value: this.value }
}

function Constant(value) {
  this.value = value
}
Constant.ignore = function() {}

Constant.prototype = new Input()
Constant.prototype.constructor = Constant
Constant.prototype[$start] = Constant.ignore
Constant.prototype[$stop] = Constant.ignore
Constant.prototype[$connect] = Constant.ignore
Constant.prototype[$disconnect] = Constant.ignore
Constant.prototype[$receive] = Constant.ignore
Constant.prototype[$error] = Constant.ignore
Constant.prototype[$end] = Constant.ignore


// Create a constant signal that never changes.

// a -> Signal a

function constant(value) {
  return new Constant(value)
}
exports.constant = constant


function Merge(inputs) {
  this[$outputs] = []
  this[$sources] = inputs
  this[$pending] = inputs.length
  this.value = inputs[0].value
}
Merge.start = function(input) {
  var sources = input[$sources]
  var count = sources.length
  var id = 0

  while (id < count) {
    var source = sources[id]
    source[$connect](source, input)
    id = id + 1
  }
}
Merge.stop = function(input) {
  var inputs = input[$sources]
  var count = inputs.length
  var id = 0
  while (id < count) {
    var source = inputs[id]
    source[$disconnect](source, input)
    id = id + 1
  }
}
Merge.end = function(input, source) {
  var sources = input[$sources]
  var id = sources.indexOf(source)
  if (id >= 0) {
    var pending = input[$pending] - 1
    input[$pending] = pending
    source[$disconnect](source, input)

    if (pending === 0)
      Input.end(input)
  }
}

Merge.prototype = new Input()
Merge.prototype.constructor = Merge
Merge.prototype[$start] = Merge.start
Merge.prototype[$stop] = Merge.stop
Merge.prototype[$end] = Merge.end

// Merge two signals into one, biased towards the
// first signal if both signals update at the same time.

// Signal x -> Signal y -> ... -> Signal z
function merge() {
  return new Merge(slicer.call(arguments, 0))
}
exports.merge = merge


// Merge many signals into one, biased towards the
// left-most signal if multiple signals update simultaneously.
function merges(inputs) {
  return new Merge(inputs)
}
exports.merges = merges


// # Past-Dependence

// Create a past-dependent signal. Each value given on the input signal
// will be accumulated, producing a new output value.

function FoldP(step, value, input) {
  this[$outputs] = []
  this[$source] = input
  this.value = value
  this.step = step
}
FoldP.receive = function(input, message, source) {
  Input.receive(input, input.step(input.value, message))
}

FoldP.prototype = new Input()
FoldP.prototype.constructor = FoldP
FoldP.prototype[$receive] = FoldP.receive


function foldp(step, x, xs) {
  return new FoldP(step, x, xs)
}
exports.foldp = foldp


// Optimized version that tracks single input.
function Lift(step, input) {
  this.step = step
  this[$source] = input
  this[$outputs] = []
  this.value = step(input.value)
}
Lift.receive = function(input, message) {
  Input.receive(input, input.step(message))
}

Lift.prototype = new Input()
Lift.prototype.constructor = Lift
Lift.prototype[$receive] = Lift.receive

function LiftN(step, inputs) {
  var count = inputs.length
  var id = 0
  var params = Array(count)
  while (id < count) {
    var input = inputs[id]
    params[id] = input.value
    id = id + 1
  }
  var value = step.apply(step, params)

  this.step = step
  this[$outputs] = []
  this[$sources] = inputs
  this[$pending] = inputs.length
  this[$state] = params
  this.value = value
}
LiftN.start = Merge.start
LiftN.stop = Merge.stop
LiftN.end = Merge.end


LiftN.receive = function(input, message, source) {
  var params = input[$state]
  var index = input[$sources].indexOf(source)
  var step = input.step
  params[index] = message
  return Input.receive(input, step.apply(step, params))
}

LiftN.prototype = new Input()
LiftN.prototype.constructor = LiftN
LiftN.prototype[$start] = LiftN.start
LiftN.prototype[$stop] = LiftN.stop
LiftN.prototype[$end] = LiftN.end
LiftN.prototype[$receive] = LiftN.receive

var slicer = [].slice

// Transform given signal(s) with a given `step` function.

// (x -> y -> ...) -> Signal x -> Signal y -> ... -> Signal z
function lift(step, xs, ys) {
  return ys ? new LiftN(step, slicer.call(arguments, 1)) :
         new Lift(step, xs)
}
exports.lift = lift
exports.lift2 = lift
exports.lift3 = lift
exports.lift4 = lift
exports.lift5 = lift
exports.lift6 = lift
exports.lift7 = lift
exports.lift8 = lift
exports.liftN = lift


// Combine a array of signals into a signal of arrays.
function combine(inputs) {
  return new LiftN(Array, inputs)
}
exports.combine = combine



// Count the number of events that have occured.

// Signal x -> Signal Int
function count(xs) {
  return foldp(function(x, y) {
    return x + 1
  }, 0, xs)
}
exports.count = count

// Count the number of events that have occured that
// satisfy a given predicate.

// (x -> Bool) -> Signal x -> Signal Int
function countIf(p, xs) {
  return count(keepIf(p, xs.value, xs))
}
exports.countIf = countIf

// # Filters

function KeepIf(p, value, input) {
  this.p = p
  this.value = p(input.value) ? input.value : value
  this[$outputs] = []
  this[$source] = input
}
KeepIf.receive = function(input, message) {
  if (input.p(message))
    Input.receive(input, message)
}
KeepIf.prototype.constructor = KeepIf
KeepIf.prototype = new Input()
KeepIf.prototype[$receive] = KeepIf.receive

// Keep only events that satisfy the given predicate.
// Elm does not allow undefined signals, so a base case
// must be provided in case the predicate is never satisfied.

// (x -> Bool) -> x -> Signal x -> Signal x
function keepIf(p, x, xs) {
  return new KeepIf(p, x, xs)
}
exports.keepIf = keepIf


function DropIf(p, value, input) {
  this.p = p
  this.value = p(input.value) ? value : input.value
  this[$source] = input
  this[$outputs] = []
}
DropIf.receive = function(input, message) {
  if (!input.p(message))
    Input.receive(input, message)
}
DropIf.prototype = new Input()
DropIf.prototype.constructor = DropIf
DropIf.prototype[$receive] = DropIf.receive

// Drop events that satisfy the given predicate. Elm does not allow
// undefined signals, so a base case must be provided in case the
// predicate is never satisfied.

// (x -> Bool) -> x -> Signal x -> Signal x
function dropIf(p, x, xs) {
  return new DropIf(p, x, xs)
}
exports.dropIf = dropIf


// Keep events only when the first signal is true. When the first signal
// becomes true, the most recent value of the second signal will be propagated.
// Until the first signal becomes false again, all events will be propagated.
// Elm does not allow undefined signals, so a base case must be provided in case
// the first signal is never true.

// Signal Bool -> x -> Signal x -> Signal x
function Skip() { return Skip }
function isSkip(x) { return x === Skip }
function skipIfTrue(isTrue, x) { return isTrue ? Skip : x }
function skipIfFalse(isTrue, x) { return isTrue ? x : Skip }

function keepWhen(state, x, xs) {
  var input = lift(skipIfFalse, dropRepeats(state), xs)
  return dropIf(isSkip, x, input)
}
exports.keepWhen = keepWhen

// Drop events when the first signal is true. When the first signal
// becomes false, the most recent value of the second signal will be
// propagated. Until the first signal becomes true again, all events
// will be propagated. Elm does not allow undefined signals, so a base
// case must be provided in case the first signal is always true.

// Signal Bool -> x -> Signal x -> Signal x
function dropWhen(state, x, xs) {
  var input = lift(skipIfTrue, dropRepeats(state), xs)
  return dropIf(isSkip, x, input)
}
exports.dropWhen = dropWhen

// Drop sequential repeated values. For example, if a signal produces
// the sequence [1,1,2,2,1], it becomes [1,2,1] by dropping the values
// that are the same as the previous value.

// Signal x -> Signal x
function dropRepeats(xs) {
  return dropIf(function(x) {
    return xs.value === x
  }, xs.value, xs)
}
exports.dropRepeats = dropRepeats

// Sample from the second input every time an event occurs on the first
// input. For example, (sampleOn clicks (every second)) will give the
// approximate time of the latest click.

// Signal a -> Signal b -> Signal b
function sampleOn(ticks, input) {
  return merge(dropIf(True, input.value, input),
               lift(function(_) { return input.value }, ticks))
}
exports.sampleOn = sampleOn

function True() { return true }
