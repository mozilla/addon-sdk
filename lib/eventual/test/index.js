"use strict";

var eventual = require("../decorate")
var when = require("../when")
var apply = require("../apply")
var defer = require("../defer")
var deliver = require("pending/deliver")

var sum = eventual(function(a, b) { return a + b })

exports["test non-eventual values"] = function(assert) {
  assert.equal(sum(2, 3), 5, "call on non-eventuals returns value")
}

exports["test apply non-eventual"] = function(assert) {
  ;[
    { a: 1 },
    [ "b", 2 ],
    "hello world",
    5,
    /foo/,
    function bar() {},
    Date(),
    undefined,
    null
  ].forEach(function(expected) {
    apply(function(actual) {
      assert.equal(actual, expected, "apply can be called on: " + expected)
    }, [expected])
  })
}

exports["test delivered eventuals"] = function(assert) {
  var a = defer(), b = 3
  deliver(a, 1)

  assert.equal(sum(a, b), 4, "call on delivered eventual returns value")
}

exports["test apply on eventuals"] = function(assert) {
  ;[
    { a: 1 },
    [ "b", 2 ],
    "hello world",
    5,
    /foo/,
    function bar() {},
    Date(),
    undefined,
    null
  ].forEach(function(expected) {
    var value = defer()
    deliver(value, expected)
    apply(function(actual) {
      assert.equal(actual, expected, "apply works with eventual: " + expected)
    }, [value])
  })
}

exports["test undelivered eventuals"] = function(assert) {
  var expected = 7
  var a = defer()
  var b = sum(a, 1)

  assert.ok(typeof(b) === "object", "call on non-delivered returns eventual")

  var c = sum(b, 3)

  apply(function(value) {
    assert.equal(value, expected, "eventual resolved as expected")
  }, [a])

  apply(function(value) {
    assert.equal(value, expected + 1, "eventual operation resolved as expected")
  }, [b])

  apply(function(value) {
    assert.equal(value, expected + 1 + 3, "eventuals chain as expected")
  }, [c])

  deliver(a, expected)
}

exports["test all observers are notified"] = function(assert, done) {
  var expected = "Taram pam param!"
  var deferred = defer()
  var pending = 10, i = 0

  function realized(value) {
    assert.equal(value, expected, "value resolved as expected: #" + pending)
    if (!--pending) done()
  }

  while (i++ < pending) when(deferred, realized)

  deliver(deferred, expected)
}

exports["test exceptions dont stop notifications"] = function(assert, done) {
  var threw = false, boom = Error("Boom!")
  var deferred = defer()

  var chained = when(deferred, function() {
    threw = true
    throw boom
  })

  when(deferred, function() {
    assert.ok(threw, "observer is called even though previos one threw")
    when(chained, function() {
      assert.fail("should not resolve")
    }, function(error) {
      assert.equal(error, boom, "rejects to thrown error")
      done()
    })
  })

  deliver(deferred, "go!")
}

exports["test subsequent resolves are ignored"] = function(assert, done) {
  var deferred = defer()
  deliver(deferred, 1)
  deliver(deferred, 2)
  deliver(deferred, 3)

  when(deferred, function(actual) {
    assert.equal(actual, 1, "resolves to first value")
  }, function() {
    assert.fail("must not reject")
  })

  when(deferred, function(actual) {
    assert.equal(actual, 1, "subsequent resolutions are ignored")
    done()
  }, function() {
    assert.fail("must not reject")
  })
}

exports["test subsequent rejections are ignored"] = function(assert, done) {
  var deferred = defer()
  deliver(deferred, Error(1))
  deliver(deferred, 2)
  deliver(deferred, Error(3))

  when(deferred, function(actual) {
    assert.fail("must not resolve")
  }, function(error) {
    assert.equal(error.message, 1, "must reject to first")
  })
  when(deferred, function(actual) {
    assert.fail("must not resolve")
  }, function(error) {
    assert.equal(error.message, 1, "must reject to first")
    done()
  })
}

exports["test error recovery"] = function(assert, done) {
  var boom = Error("Boom!")
  var deferred = defer()

  var recovered = when(deferred, function() {
    assert.fail("rejected promise should not resolve")
  }, function(reason) {
    assert.equal(reason, boom, "rejection reason delivered")
    return "recovery"
  })

  when(recovered, function(value) {
    assert.equal(value, "recovery", "error handled by a handler")
    done()
  })

  deliver(deferred, boom)
}

exports["test error recovery with promise"] = function(assert, done) {
  var deferred = defer()

  var r1 = when(deferred, function() {
    assert.fail("must reject")
  }, function(actual) {
    assert.equal(actual.message, "reason", "rejected")
    var deferred = defer()
    deliver(deferred, "recovery")
    return deferred
  })

  var r2 = when(r1, function(actual) {
    assert.equal(actual, "recovery", "recorvered via promise")
    var deferred = defer()
    deliver(deferred, Error("error"))
    return deferred
  })


  var r3 = when(r2, null, function(actual) {
    assert.equal(actual.message, "error", "rejected via promise")
    var deferred = defer()
    deliver(deferred, Error("end"))
    return deferred
  })

  when(r3, null, function(actual) {
    assert.equal(actual.message, "end", "rejeced via promise")
    done()
  })

  deliver(deferred, Error("reason"))
}



exports["test propagation"] = function(assert, done) {
  var d1 = defer(), d2 = defer(), d3 = defer()

  when(d1, function(actual) {
    assert.equal(actual, "expected", "resolves to expected value")
    done()
  })

  deliver(d1, d2)
  deliver(d2, d3)
  deliver(d3, "expected")
}


exports["test chaining"] = function(assert, done) {
  var boom = Error("boom"), brax = Error("braxXXx")
  var deferred = defer()

  var c1 = when(deferred)
  var c2 = when(c1)
  var c3 = when(c2, function(actual) {
    assert.equal(actual, 2, "value propagates unchanged")
    return actual + 2
  })
  var c4 = when(c3, null, function(reason) {
    assert.fail("should not reject")
  })
  var c5 = when(c4, function(actual) {
    assert.equal(actual, 4, "value propagates through if not handled")
    throw boom
  })
  var c6 = when(c5, function(actual) {
    assert.fail("exception must reject promise")
  })
  var c7 = when(c6)
  var c8 = when(c7)
  var c9 = when(c8, null, function(actual) {
    assert.equal(actual, boom, "reason propagates unchanged")
    throw brax
  })
  var c10 = when(c9)
  var c11 = when(c10, null, function(actual) {
    assert.equal(actual, brax, "reason changed becase of exception")
    return "recovery"
  })

  when(c11, function(actual) {
    assert.equal(actual, "recovery", "recovered from error")
    done()
  })

  deliver(deferred, 2)
}


require("test").run(exports)
