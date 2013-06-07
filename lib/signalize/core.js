"use strict";

var method = require("method/core")

// Signals implement `spawn` method.
var spawn = method("spawn@signalize")
exports.spawn = spawn

function Meta(value) {
  this.value = value
}
Meta.prototype.isMeta = true
Meta.prototype.valueOf = function() {
  return this.value
}
exports.Meta = Meta

  /**
  Signal data structure can be finit or infinite. Finite
  signals notify that they've ended via special `END`
  constant value. Constant is a also a function invoking
  it still returns `END`.
  **/

var END = new Meta("end")
exports.END = END

  /**
  Optionally signals may support interruption if they recieve
  special `STOP` value as a return value of yield.
  **/
var STOP = new Meta("stop")
exports.STOP = STOP

function isMeta(value) {
  return (value && value.isMeta) || isError(value)
}

var toString = Object.prototype.toString
function isError(value) {
  /**
  Signals can contain failures, which just need to be yield.
  This utility function can be used to detect if value is an
  error
  **/
  return toString.call(value) === "[object Error]"
}
exports.isError = isError

function spawnIdentity(value, next) {
  /**
  Any value can be spawned as signal, by default (unless
  defined otherwise) they'll be treated as finite signals
  of that value, resembling identity function.
  **/
  next(value)
  next(END)
}
spawn.define(spawnIdentity)


function spawnIndexed(indexed, next) {
  /**
  Most array like indexed objects next their
  elements when spawned.
  **/
  var index = 0
  var count = indexed.length
  var result
  while (index < count) {
    result = next(indexed[index])
    index = index + 1
    if (result === STOP) break
  }
  next(END)
}

spawn.define(Array, spawnIndexed)
spawn.define(String, spawnIndexed)

function empty() {
  /**
  Signal that is empty, there for ends immediately

  empty // => < >
  **/
  return empty
}
spawn.implement(empty, function(empty, next) {
  next(END)
})
exports.empty = empty


function Signal(spawn) {
  /**
  Type reperesenting signals
  **/
  this.spawn = spawn
}
spawn.define(Signal, function(signal, next) {
  return signal.spawn(next)
})


function signal(spawn) {
  /**
  Constructs signal value from a function that is given
  invoked every time signal is spawned passing it a `next`
  function for yielding a new values.

  signal(function(next) {
    next(1)
    next(2)
    next(END)
  })
  **/
  return new Signal(spawn)
}


function Constant(value) {
  /**
  Type for a contstant signal that never changes or
  ends
  **/
  this.value = value
}
Constant.prototype = Object.create(Signal.prototype)
spawn.define(Constant, function(constant, next) {
  next(constant.value)
})

function constant(value) {
  /**
  Create a constant signal that never changes or ends.

  constant(1) // => <1
  **/
  return new Constant(value)
}
exports.constant = constant


function folds(folder, start, input) {
  /**
  Create a past-dependent signal. Each value given on the
  input signal will be accumulated, producing a new output
  value. Note that special meta values like errors or `END`
  pass through and do not invoke `folder`.

  function sum(a, b) { return a + b }
  folds(sum, 0, [1, 2, 3, 4])        // => <1 3 6 10>
  **/
  return signal(function(next) {
    var transformed = false
    var result = start
    return spawn(input, function(item) {
      if (isMeta(item) || transformed)
        return next(item)

      var value = folder(item, result)
      if (SKIP === value) return result
      if (LAST === value) return result = (next(item), STOP)
      if (STOP === value) return result = STOP
      if (FORWARD === value) return result = (transformed = true, next(item))
      return result = next(value)
    })
  })
}
exports.folds = folds

// Transformation instruction constant indicating that value must be
// skipped.
var SKIP = new Meta("skip")
exports.SKIP = SKIP

// Transformation instruction constant that indicates that all the
// following items can be just forwaded without furthor transformation.
var FORWARD = new Meta("forward")
exports.FORWARD = FORWARD

// Transformation instruction constant indicating that input must
// be stopped immediately and given value must be dropped.
// Transformation instruction constant indicating that input must
// be stopped but this value must be forwarded.
var LAST = new Meta("last")
exports.LAST = LAST


function map(f, input) {
  /**
  Transform a signal with a given function.

  function inc(x) { return x + 1 }
  map(inc, [ 1, 2, 3, 4 ]) // => <2 3 4 5>
  map(inc, constant(3))    // => <4
  map(inc, [])             // =>
  map(inc, [1])            // => <2>
  map(inc, 5)              // => <6>
  map(inc, void(0))        // => <NaN>
  **/
  return folds(function(item) {
    return f(item)
  }, null, input)
}
exports.map = map


function filter(p, input) {
  /**
  function isEven(x) { return !(x % 2) }
  filter(isEven, [ 1, 2, 3, 4, 5 ])           // => <2 4>
  filter(isEven, [ 1, 3 ])                    // => < >
  filter(isEven, map(inc, [ 2, 3, 4, 5 ]))    // => <4 6>
  **/

  return folds(function(item) {
    return p(item) ? item : SKIP
  }, null, input)
}
exports.filter = filter


function takeWhile(p, input) {
  /**
  function isEven(x) { return !(x % 2) }
  takeWhile(isEven, [2, 4, 6, 7, 8])         // => <2 4 6>
  **/
  return folds(function(item) {
    return p(item) ? item : STOP
  }, null, input)
}
exports.takeWhile = takeWhile


function dropWhile(p, input) {
  /**
  function isEven(x) { return !(x % 2) }
  dropWhile(isEven, [2, 4, 6, 7, 8, 9])     // => <7 8 9>
  **/
  return folds(function(item) {
    return p(item) ? SKIP : FORWARD
  }, null, input)
}
exports.dropWhile = dropWhile


function taker(n) {
  return function(item) {
    n = n - 1
    return n < 0 ? STOP :
           n === 0 ? LAST :
           item
  }
}

function take(n, input) {
  /**
  take(3, [1, 2, 3, 4, 5])             // => <1 2 3>
  **/
  return signal(function(next) {
    spawn(folds(taker(n), null, input), next)
  })
}
exports.take = take

function dropper(n) {
  return function(item) {
    n = n - 1
    return n < 0 ? FORWARD : SKIP
  }
}

function drop(n, input) {
  /**
  drop(3, [1, 2, 3, 4, 5])           // => <4 5>
  **/
  return signal(function(next) {
    spawn(folds(dropper(n), null, input), next)
  })
}
exports.drop = drop

function Concatination(left, right) {
  this.left = left
  this.right = right
}
Concatination.prototype = Object.create(Signal.prototype)
spawn.define(Concatination, function(concatination, next) {
  var state = null
  return spawn(concatination.left, function(value) {
    if (value !== END) state = next(value)
    else if (state !== STOP) spawn(concatination.right, next)
    else state = next(value)
    return state
  })
})

function concat() {
  /**
  concat([1, 2, 3], [5, 6]) // => <1 2 3 5 6>
  concat([1, 2, 3]) // => <1 2 3>
  concat() // => < >
  **/
  return arguments.length ? Array.prototype.reduce.call(arguments, function(left, right) {
    return new Concatination(left, right)
  }) : []
}
exports.concat = concat

// Meta value representing start of the group.
var START = new Meta("start")

function stoper(input) {
  /**
  Forces stop after first occurance. Ignores anything
  yield after `STOP` is returned and always returns
  `STOP` from that point on.
  **/
  return folds(function(value, state) {
    return state === STOP ? STOP : value
  }, null, input)
}

// Takes input that represents groups wrapped in `START`
// and `END` items and returns input that contains all
// items, but `START` & `END` except the last `END`.
function ender(input) {
  return signal(function(next) {
    var pending = 0
    var state = null
    return spawn(input, function(item) {
      state = item === START ? (pending = pending + 1,
                                state) :
              item === END ? (pending = pending - 1,
                              pending ? state : next(item)) :
              next(item)
      return state
    })
  })
}


function merge(inputs) {
  /**
  Merges signal of signals into one uniform signal. Result
  is merged by time of yields, biased towards the left-most
  signal if multiple signals yield simultaneously.

  merge([[1, 2], [3, 4]]) // => <1 2 3 4>
  merge([
    map(inc, [1, 3 ]),
    [],
    [4, 5, 6],
    null,
    7,
    [9, 10]
  ])
  // => <2 4 4 5 6 null 7 9 10>

  takeWhile(isEven, merge([
    map(inc, [1, 3 ]),
    [4, 5, 6],
    7,
    [9, 10]
  ]))
  // => <2 4 4>
  **/
  var merged = signal(function(next) {
    var result = next(START)
    spawn(inputs, function(input) {
      next(START)
      spawn(input, next)
    })
    return result
  })
  return stoper(ender(merged))
}
exports.merge = merge

function expand(f, input) {
  return merge(map(f, input))
}
exports.expand = expand