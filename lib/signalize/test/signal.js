"use strict";

var isReduced = require("../is-reduced")
var flatten = require("../flatten")
var take = require("../take")
var reduce = require("../reduce")
var into = require("../into")
var signal = require("../signal")
var emit = require("../emit")
var close = require("../close")
var when = require("eventual/when")
var isClosed = signal.isClosed
var isOpen = signal.isOpen

exports["test signal basics"] = function(assert, done) {
  var c = signal()

  assert.ok(!signal.isOpen(c), "signal is not open")
  assert.ok(!signal.isClosed(c), "signal is not closed")

  var p = into(c)

  assert.ok(signal.isOpen(c), "signal is open after reduce is called")
  assert.ok(!signal.isClosed(c), "signal is not closed until close is called")

  when(p, function(actual) {
    assert.deepEqual(actual, [ 1, 2, 3, 4 ],
                     "All queued values were accumulated")
    assert.ok(signal.isClosed(c), "signal is closed after it is closed")
    done()
  })

  emit(c, 1)
  emit(c, 2)
  emit(c, 3)
  close(c, 4)
}

exports["test signal auto-close"] = function(assert, done) {
  var c = signal()

  assert.ok(!signal.isOpen(c), "signal is not open")
  assert.ok(!signal.isClosed(c), "signal is not closed")

  var t = take(c, 3)

  assert.ok(!signal.isOpen(c), "signal is not open on take")
  assert.ok(!signal.isClosed(c), "signal is not closed on take")

  var p = into(t)

  assert.ok(signal.isOpen(c), "signal is open after reduce is called")
  assert.ok(!signal.isClosed(c), "signal is not closed until close is called")

  emit(c, 1)
  emit(c, 2)
  emit(c, 3)

  assert.ok(signal.isClosed(c), "signal is closed once consumption is complete")

  var emitresult = emit(c, 4)
  assert.ok(isReduced(emitresult),
            "emit on closed signal returns accumulated")


  var closeresult = close(c)
  assert.ok(isReduced(closeresult),
            "close on closed signal returns accumulated")


  when(p, function(actual) {
    assert.deepEqual(actual, [ 1, 2, 3 ],
                     "All queued values were accumulated")
    assert.ok(signal.isClosed(c), "signal is closed after it is closed")
    done()
  })
}

exports["test signal can have single consumer"] = function(assert, done) {
  var c = signal()
  var p = into(c)

  assert.throws(function() {
    reduce(c, function() { })
  }, "signal can be consumed by a single reader only")

  close(c, 0)
  when(p, function(actual) {
    assert.deepEqual(actual, [ 0 ], "items were accumulated")
    done()
  })
}

/*
exports['test signal'] = function(assert, done) {
  var first = signal()
  var second = signal()

  var actual = into(sequential(flatten([ first, second ])))

  emit(second, 21)
  emit(first, 11)
  emit(first, 12)
  emit(second, 22)
  emit(second, 23)
  close(second)
  close(first)

  go(function(actual) {
    assert.deepEqual(actual, [ 11, 12, 21, 22, 23 ], 'signals preserve order')
    done()
  }, actual)
}

exports['test signal of signals'] = function(assert, done) {
  var owner = signal()
  var first = signal()
  var second = signal()

  var ordered = into(sequential(flatten(owner)))
  var unordered = into(flatten(owner))

  emit(owner, first)
  emit(first, 11)
  emit(owner, second)
  emit(second, 21)
  emit(first, 12)
  emit(second, 22)
  emit(second, 23)
  close(second)
  close(first)
  close(owner)

  go(function(ordered, unordered) {
    assert.deepEqual(ordered, [ 11, 12, 21, 22, 23 ], 'signals preserve order')
    assert.deepEqual(unordered, [ 11, 21, 12, 22, 23 ], 'fifo')
    done()
  }, ordered, unordered)
}

exports['test signal auto closes'] = function(assert, done) {
  var source = signal()
  var subset = pick(3, source)
  var actual = into(subset)

  emit(source, 1)
  emit(source, 2)
  emit(source, 3)

  assert.ok(closed(source), 'signal is closed once consumption is done')

  emit(source, 4)
  emit(source, 5)

  assert.ok(closed(source), 'signal is still closed')

  go(function(actual) {
    assert.deepEqual(actual, [ 1, 2, 3 ], 'no new item were apended')
    done()
  }, actual)
}

exports['test auto close of signal of signals'] = function(assert, done) {
  var owner = signal(0), first = signal(1), second = signal(2)
  var flat = flatten(owner)
  var ordered = into(pick(2, sequential(flat)))
  var unordered = into(pick(4, flat))


  emit(owner, first)
  emit(owner, second)
  emit(second, 21)
  emit(first, 11)
  emit(first, 12)
  assert.ok(!closed(owner), 'signal is still open')
  emit(second, 22)
  emit(second, 23)
  emit(first, 13)

  assert.ok(closed(first), 'first signal is closed')
  assert.ok(closed(second), 'second signal is closed')
  assert.ok(closed(owner), 'owner signal is also closed')

  go(function(ordered, unordered) {
    assert.deepEqual(ordered, [ 11, 12 ], 'no new item were apended')
    assert.deepEqual(unordered, [ 21, 11, 12, 22 ], 'paralleled')
    done()
  }, ordered, unordered)
}
*/

if (module == require.main)
  require("test").run(exports)
