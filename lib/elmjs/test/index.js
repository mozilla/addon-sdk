"use strict";

var signal = require("../signal")
var Input = signal.Input
var Break = signal.Break
var Return = signal.Return
var connect = signal.connect
var disconnect = signal.disconnect
var start = signal.start
var stop = signal.stop
var receive = signal.receive
var error = signal.error
var end = signal.end
var send = signal.send

function Subject(options) {
  var options = options || {}
  this[signal.outputs] = []
  this.name = "subject"
  this.onStart = options.onStart
  this.onStop = options.onStop
  this.value = options.value
  this.started = 0
  this.stopped = 0
}
Subject.prototype = new Input()
Subject.prototype[start] = function() {
  this.started = this.started + 1
  if (this.onStart)
    this.onStart()
}
Subject.prototype[stop] = function() {
  this.stopped = this.stopped + 1
  if (this.onStop)
    this.onStop()
}
Subject.prototype.toJSON = function() {
  return {
    started: this.started,
    stopped: this.stopped,
    value: this.value
  }
}

function Client(options) {
  options = options || {}
  this.messages = []
  this.errors = []
  this.ends = []

  this.onNext = options.onNext
  this.onError = options.onError
  this.onEnd = options.onEnd

}
Client.prototype[receive] = function(input, message, source) {
  this.messages.push(message)
  return this.onNext && input.onNext(message, source)
}
Client.prototype[error] = function(input, message, source) {
  this.errors.push(message)
  return this.onError && input.onError(message, source)
}
Client.prototype[end] = function(input, source) {
  this.ends.push(true)
  return this.onEnd && input.onEnd(source)
}
Client.prototype.toJSON = function() {
  return {
    messages: this.messages,
    errors: this.errors,
    ends: this.ends
  }
}

exports["test 2 messages & end"] = function(assert) {
  var subject = new Subject({ value: null })

  assert.deepEqual(subject.toJSON(), {
    started: 0,
    stopped: 0,
    value: null
  }, "nothing changed")

  var client = new Client()
  connect(subject, client)

  assert.deepEqual(subject.toJSON(), {
    started: 1,
    stopped: 0,
    value: null
  }, "subject started")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "nothing received yet")

  send(subject, 1)

  assert.deepEqual(subject.toJSON(), {
    value: 1,
    started: 1,
    stopped: 0
  }, "value changed to 1")

  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "client received one message")

  receive(subject, 2)

  assert.deepEqual(subject.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "value changed to 2")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "client received second message")

  end(subject)

  assert.deepEqual(subject.toJSON(), {
    value: 2,
    started: 1,
    stopped: 1
  }, "value changed to 2")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: [true]
  }, "client received second message")
}

exports["test multiple connections"] = function(assert) {
  var source = new Subject({ value: null });
  var order = []

  assert.deepEqual(source.toJSON(), {
    started: 0,
    stopped: 0,
    value: null
  }, "nothing happened yet")

  var client1 = new Client({
    onNext: function() {
      order.push(1)
    }
  });

  connect(source, client1)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: null
  }, "source was started")

  send(source, 1)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "source.value changed to 1")

  assert.deepEqual(client1.toJSON(), {
    ends: [],
    messages: [1],
    errors: []
  }, "one message received on clien1")

  var client2 = new Client({
    onNext: function() {
      order.push(2)
    }
  })

  connect(source, client2);

  send(source, 2)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source.value changed to 2");

  assert.deepEqual(client1.toJSON(), {
    ends: [],
    messages: [1, 2],
    errors: []
  }, "messagese received on client 1")

  assert.deepEqual(client2.toJSON(), {
    ends: [],
    messages: [2],
    errors: []
  }, "message received on clien 2");

  var client3 = new Client({
    onNext: function() {
      order.push(3)
      return new Break()
    }
  })

  connect(source, client3)

  send(source, 3)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source.value changed to 3")

  assert.deepEqual(client1.toJSON(), {
    messages: [1, 2, 3],
    errors: [],
    ends: []
  }, "client1 received 3 messages")

  assert.deepEqual(client2.toJSON(), {
    messages: [2, 3],
    errors: [],
    ends: []
  }, "client2 received 2 messages")

  assert.deepEqual(client3.toJSON(), {
    messages: [3],
    errors: [],
    ends: []
  }, "client3 received 1 message")

  send(source, 4)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source.value changed to 4")

  assert.deepEqual(client1.toJSON(), {
    messages: [1, 2, 3, 4],
    errors: [],
    ends: []
  }, "client1 received 4 messages")

  assert.deepEqual(client2.toJSON(), {
    messages: [2, 3, 4],
    errors: [],
    ends: []
  }, "client2 received 3 messages")

  assert.deepEqual(client3.toJSON(), {
    messages: [3],
    errors: [],
    ends: []
  }, "client3 did not got last message")

  end(source)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 1,
    value: 4
  }, "source stopped")

  assert.deepEqual(client1.toJSON(), {
    messages: [1, 2, 3, 4],
    errors: [],
    ends: [true]
  }, "client1 received 4 messages")

  assert.deepEqual(client2.toJSON(), {
    messages: [2, 3, 4],
    errors: [],
    ends: [true]
  }, "client2 received 3 messages")

  assert.deepEqual(client3.toJSON(), {
    messages: [3],
    errors: [],
    ends: []
  }, "client3 did not got last message")

  assert.deepEqual(order,
                   [1, 1, 2, 1, 2, 3, 1, 2],
                   "order of received message is correct")
}

exports["test last disconnect stops"] = function(assert) {
  var source = new Subject({ value: 0 })
  var client = new Client({
    onNext: function(message) {
      return new Break()
    }
  })

  assert.deepEqual(source.toJSON(), {
    value: 0,
    started: 0,
    stopped: 0
  }, "source is in initial state")

  connect(source, client)

  assert.deepEqual(source.toJSON(), {
    value: 0,
    started: 1,
    stopped: 0
  }, "source in started state")
  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "client got nothing so far")

  send(source, 1)

  assert.deepEqual(source.toJSON(), {
    value: 1,
    started: 1,
    stopped: 1
  }, "source was stopped")
  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "client got one message")
}

exports["test same client can connect once"] = function(assert) {
  var source = new Subject({ value: null })
  var client = new Client()

  connect(source, client)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: null
  }, "source started")

  send(source, 1)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "source value changed to 1")
  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "got one message")

  connect(source, client)
  send(source, 2)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source value changed to 2")
  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "got only one message")
}

exports["test manual disconnect stops"] = function(assert) {
  var source = new Subject({ value: 0 })
  var a = new Client()
  var b = new Client()

  connect(source, a)
  connect(source, b)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 0
  }, "input started")

  send(source, 1)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "source.value is 1")

  assert.deepEqual(a.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "a got a message")

  assert.deepEqual(b.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "b got a message")

  disconnect(source, a)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "source.value is 1")

  assert.deepEqual(a.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "disconnected a did not get a message")

  send(source, 2)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source.value is 2")

  assert.deepEqual(a.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "disconnected a did not get a message")

  assert.deepEqual(b.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "b got a message")

  disconnect(source, b)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 1,
    value: 2
  }, "source was stopped")

  assert.deepEqual(a.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "a didn't change")

  assert.deepEqual(b.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "b ended")
}


var constant = signal.constant
exports["test constant"] = function(assert) {
  var one = constant(1)

  assert.equal(one.value, 1, "value is given one")

  var received = 0
  var errored = 0
  var ended = 0

  var client = new Client()
  connect(one, client)

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "nothing received");
}

var lift = signal.lift
exports["test lift1"] = function(assert) {
  var order = []
  var source = new Subject({ value: 0 })

  assert.equal(source.value, 0, "value is 0")

  var xs = lift(function(x) { return x + 1 }, source)
  var ys = lift(function(x) { return x * 2 }, source)
  var zs = lift(function(y) { return y + 2 }, ys)

  assert.deepEqual(source.toJSON(), {
    started: 0,
    stopped: 0,
    value: 0
  }, "source isn't started yet")

  assert.equal(xs.value, 1, "xs.value is 1")
  assert.equal(ys.value, 0, "ys.value is 0")
  assert.equal(zs.value, 2, "zs.value is 2")

  var zclient = new Client({ onNext: function() { order.push("z") } })
  connect(zs, zclient)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 0
  }, "source started")

  send(source, 3)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value is 3")

  assert.deepEqual(zclient.toJSON(), {
    messages: [8],
    errors: [],
    ends: []
  }, "message received on the client")

  assert.equal(xs.value, 1, "xs.value didn't changed")
  assert.equal(ys.value, 6, "ys.value changed to 6")
  assert.equal(zs.value, 8, "zs.value changed to 8")

  var xclient = new Client({ onNext: function() { order.push("x") }})
  connect(xs, xclient)

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source didnt changed")

  assert.deepEqual(zclient.toJSON(), {
    messages: [8],
    errors: [],
    ends: []
  }, "message received on the client")

  assert.deepEqual(xclient.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "nothing happende yet")

  send(source, Return(4))

  assert.deepEqual(source.toJSON(), {
    started: 1,
    stopped: 1,
    value: 4
  }, "source value is 4 and it's stopped")

  assert.deepEqual(zclient.toJSON(), {
    messages: [8, 10],
    errors: [],
    ends: [true]
  }, "z client received message & ended")

  assert.deepEqual(xclient.toJSON(), {
    messages: [5],
    errors: [],
    ends: [true]
  }, "x client received message & ended")

  assert.equal(xs.value, 5, "xs.value changed to 5")
  assert.equal(ys.value, 8, "ys.value changed to 8")
  assert.equal(zs.value, 10, "zs.value changed to 10")
}

exports["test liftN"] = function(assert) {
  var xs = new Subject({ value: 0 })
  var ys = new Subject({ value: 5 })
  var client = new Client();

  var xys = lift(function(x, y) {
    return x + y
  }, xs, ys);

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 0
  }, "xs has not started yet")

  assert.deepEqual(ys.toJSON(), {
    started: 0,
    stopped: 0,
    value: 5
  }, "ys has not started yet")

  assert.equal(xys.value, 5, "xys.value is 5")

  connect(xys, client);

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 0
  }, "xs started")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "ys started")

  assert.equal(xys.value, 5, "xys.value is still 5")

  send(xs, 1)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs.value changed to 1")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "ys value didn't change")

  assert.equal(xys.value, 6, "xys.value changed to 6")

  send(ys, 6)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs.value is still 1")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 6
  }, "ys value changed to 6")

  assert.equal(xys.value, 7, "xys.value changed to 7")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value changed to 2")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 6
  }, "ys value didn't change")

  assert.equal(xys.value, 8, "xys.value changed to 8")

  send(ys, 8)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value didn't change")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 8
  }, "ys value changed to 8")

  assert.equal(xys.value, 10, "xys.value changed to 10")

  send(ys, Return(5))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value didn't change")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "ys value changed to 5 & stopped")

  assert.equal(xys.value, 7, "xys.value changed to 7")

  send(xs, 5)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "xs.value changed to 5")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "ys value didn't change")

  assert.equal(xys.value, 10, "xys.value changed to 10")

  send(xs, Return(7))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 7
  }, "stopped and changed xs.value to 7")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "ys value didn't change")

  assert.equal(xys.value, 12, "xys.value changed to 12")

  assert.deepEqual(client.toJSON(), {
    messages: [6, 7, 8, 10, 7, 10, 12],
    errors: [],
    ends: [true]
  }, "all messages received on the client")
}



var keepIf = signal.keepIf
var isOdd = function(x) { return x % 2 }
var isEven = function(x) { return !(x % 2) }
exports["test keepIf (keep initial)"] = function(assert) {
  var xs = new Subject({ value: 1 })
  var ys = keepIf(isOdd, 0, xs)

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 1
  }, "xs is in initial state")

  assert.equal(ys.value, 1, "xs.value is kept since it's odd")

  var client = new Client()

  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs started")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages received yet")

  assert.equal(ys.value, 1, "ys.value is 1")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value changed to 2")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages were received")

  assert.equal(ys.value, 1, "ys.value is kept 1")

  send(xs, 3)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "xs.value changed to 3")

  assert.deepEqual(client.toJSON(), {
    messages: [3],
    errors: [],
    ends: []
  }, "message was received")

  assert.equal(ys.value, 3, "ys.value updated to 3")

  send(xs, 4)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "xs.value changed to 4")

  assert.deepEqual(client.toJSON(), {
    messages: [3],
    errors: [],
    ends: []
  }, "no messages were received")

  assert.equal(ys.value, 3, "ys.value is still 3")

  send(xs, new Return(5))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "xs.value changed to 5 and stopped")

  assert.deepEqual(client.toJSON(), {
    messages: [3, 5],
    errors: [],
    ends: [true]
  }, "message & end was received")

  assert.equal(ys.value, 5, "ys.value updated to 5")
}


exports["test keepIf (update initial)"] = function(assert) {
  var xs = new Subject({ value: 1 })
  var ys = keepIf(isEven, 0, xs)

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 1
  }, "xs is in initial state")

  assert.equal(ys.value, 0, "ys.value updated since it's not even")

  var client = new Client()

  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs started")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages received yet")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value changed to 2")

  assert.deepEqual(client.toJSON(), {
    messages: [2],
    errors: [],
    ends: []
  }, "messages was received")

  assert.equal(ys.value, 2, "ys.value is updated to 2")

  send(xs, 3)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "xs.value changed to 3")

  assert.deepEqual(client.toJSON(), {
    messages: [2],
    errors: [],
    ends: []
  }, "message wasn't received")

  assert.equal(ys.value, 2, "ys.value is 3")

  send(xs, 4)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "xs.value changed to 4")

  assert.deepEqual(client.toJSON(), {
    messages: [2, 4],
    errors: [],
    ends: []
  }, "messages was received")

  assert.equal(ys.value, 4, "ys.value set to 4")

  send(xs, new Return(5))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "xs.value changed to 5 and stopped")

  assert.deepEqual(client.toJSON(), {
    messages: [2, 4],
    errors: [],
    ends: [true]
  }, "ys ended, but nothing was received")

  assert.equal(ys.value, 4, "ys.value is still 4")
}


var dropIf = signal.dropIf
exports["test dropIf (update initial)"] = function(assert) {
  var xs = new Subject({ value: 1 })
  var ys = dropIf(isOdd, 0, xs)

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 1
  }, "xs is in initial state")

  assert.equal(ys.value, 0, "ys.value updated since it's odd")

   var client = new Client()

  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs started")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages received yet")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value changed to 2")

  assert.deepEqual(client.toJSON(), {
    messages: [2],
    errors: [],
    ends: []
  }, "messages was received")

  assert.equal(ys.value, 2, "ys.value is updated to 2")

  send(xs, 3)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "xs.value changed to 3")

  assert.deepEqual(client.toJSON(), {
    messages: [2],
    errors: [],
    ends: []
  }, "message wasn't received")

  assert.equal(ys.value, 2, "ys.value is 2")

  send(xs, new Return(4))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 4
  }, "xs.value changed to 4")

  assert.deepEqual(client.toJSON(), {
    messages: [2, 4],
    errors: [],
    ends: [true]
  }, "message received & end")

  assert.equal(ys.value, 4, "ys.value is 4")
}

exports["test dropIf (keep initial)"] = function(assert) {
  var xs = new Subject({ value: 1 })
  var ys = dropIf(isEven, 0, xs)

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 1
  }, "xs is in initial state")

  assert.equal(ys.value, 1, "ys.value remained")

   var client = new Client()

  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs started")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages received yet")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value changed to 2")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "messages wasn't received")

  assert.equal(ys.value, 1, "ys.value is stayed same")

  send(xs, 3)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "xs.value changed to 3")

  assert.deepEqual(client.toJSON(), {
    messages: [3],
    errors: [],
    ends: []
  }, "message was received")

  assert.equal(ys.value, 3, "ys.value updated")

  send(xs, new Return(4))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 4
  }, "xs.value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [3],
    errors: [],
    ends: [true]
  }, "message received & end")

  assert.equal(ys.value, 3, "ys.value remained")
}


var foldp = signal.foldp
exports["test flodp"] = function(assert) {
  var xs = new Subject({ value: 0 })
  var ys = foldp(function(p, x) {
    return p + x
  }, 5, xs)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 0,
    stopped: 0
  }, "source is in inital state")

  assert.equal(ys.value, 5, "initial value is set")

  var client = new Client()

  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 1,
    stopped: 0
  }, "source was started")

  assert.equal(ys.value, 5, "still in initial state")

  send(xs, 1)

  assert.deepEqual(xs.toJSON(), {
    value: 1,
    started: 1,
    stopped: 0
  }, "source was started")

  assert.deepEqual(client.toJSON(), {
    messages: [6],
    errors: [],
    ends: []
  }, "message was received")

  assert.equal(ys.value, 6, "value changed")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source was started")

  assert.deepEqual(client.toJSON(), {
    messages: [6, 8],
    errors: [],
    ends: []
  }, "message was received")

  assert.equal(ys.value, 8, "value changed")

  send(xs, 3)

  assert.deepEqual(xs.toJSON(), {
    value: 3,
    started: 1,
    stopped: 0
   }, "source was started")

  assert.deepEqual(client.toJSON(), {
    messages: [6, 8, 11],
    errors: [],
    ends: []
  }, "message was received")

  assert.equal(ys.value, 11, "value changed")

  send(xs, new Return(4))

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 1
   }, "source was stopped")

  assert.deepEqual(client.toJSON(), {
    messages: [6, 8, 11, 15],
    errors: [],
    ends: [true]
  }, "message & end was received")

  assert.equal(ys.value, 15, "value changed")
}


var merge = signal.merge
exports["test merge"] = function(assert) {
  var xs = new Subject({ value: 0 })
  var ys = new Subject({ value: 5 })
  var xys = merge(xs, ys)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 0,
    stopped: 0
  }, "source#1 is in inital state")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 0,
    stopped: 0
  }, "source#2 is in inital state")

  assert.equal(xys.value, 0, "initial value is from source#1")

  var client = new Client()
  connect(xys, client)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 1,
    stopped: 0
  }, "source#1 is in started state")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 is in started state")

  assert.equal(xys.value, 0, "initial value is from source#1")

  send(xs, 1)

  assert.deepEqual(xs.toJSON(), {
    value: 1,
    started: 1,
    stopped: 0
  }, "source#1 value updated")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 value didn't change")

  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 1, "merged signal value updated")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source#1 value updated")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 value didn't change")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 2, "merged signal value updated")

  send(ys, 3)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source#1 value stayed")

  assert.deepEqual(ys.toJSON(), {
    value: 3,
    started: 1,
    stopped: 0
  }, "source#2 value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 3, "merged signal value updated")

  send(xs, new Return(4))

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 1
  }, "source#1 value changed & stopped")

  assert.deepEqual(ys.toJSON(), {
    value: 3,
    started: 1,
    stopped: 0
  }, "source#2 value didn't change")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 4, "merged signal value updated")

  send(ys, 5)

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 1
  }, "source#1 value changed & stopped")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4, 5],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 5, "merged signal value updated")

  send(ys, new Return(6))

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 1
  }, "source#1 value changed & stopped")

  assert.deepEqual(ys.toJSON(), {
    value: 6,
    started: 1,
    stopped: 1
  }, "source#2 value changed & stopped")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4, 5, 6],
    errors: [],
    ends: [true]
  }, "message & end received")

  assert.equal(xys.value, 6, "merged signal value updated")
}

var merges = signal.merges
exports["test merges"] = function(assert) {
  var xs = new Subject({ value: 0 })
  var ys = new Subject({ value: 5 })
  var xys = merges([xs, ys])

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 0,
    stopped: 0
  }, "source#1 is in inital state")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 0,
    stopped: 0
  }, "source#2 is in inital state")

  assert.equal(xys.value, 0, "initial value is from source#1")

  var client = new Client()
  connect(xys, client)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 1,
    stopped: 0
  }, "source#1 is in started state")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 is in started state")

  assert.equal(xys.value, 0, "initial value is from source#1")

  send(xs, 1)

  assert.deepEqual(xs.toJSON(), {
    value: 1,
    started: 1,
    stopped: 0
  }, "source#1 value updated")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 value didn't change")

  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 1, "merged signal value updated")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source#1 value updated")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 value didn't change")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 2, "merged signal value updated")

  send(ys, 3)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source#1 value stayed")

  assert.deepEqual(ys.toJSON(), {
    value: 3,
    started: 1,
    stopped: 0
  }, "source#2 value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 3, "merged signal value updated")

  send(xs, new Return(4))

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 1
  }, "source#1 value changed & stopped")

  assert.deepEqual(ys.toJSON(), {
    value: 3,
    started: 1,
    stopped: 0
  }, "source#2 value didn't change")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 4, "merged signal value updated")

  send(ys, 5)

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 1
  }, "source#1 value changed & stopped")

  assert.deepEqual(ys.toJSON(), {
    value: 5,
    started: 1,
    stopped: 0
  }, "source#2 value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4, 5],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(xys.value, 5, "merged signal value updated")

  send(ys, new Return(6))

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 1
  }, "source#1 value changed & stopped")

  assert.deepEqual(ys.toJSON(), {
    value: 6,
    started: 1,
    stopped: 1
  }, "source#2 value changed & stopped")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4, 5, 6],
    errors: [],
    ends: [true]
  }, "message & end received")

  assert.equal(xys.value, 6, "merged signal value updated")
}

var combine = signal.combine
exports["test combine"] = function(assert) {
  var xs = new Subject({ value: 0 })
  var ys = new Subject({ value: 5 })
  var client = new Client();

  var xys = combine([xs, ys]);

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 0
  }, "xs has not started yet")

  assert.deepEqual(ys.toJSON(), {
    started: 0,
    stopped: 0,
    value: 5
  }, "ys has not started yet")

  assert.deepEqual(xys.value, [0, 5], "xys.value combined")

  connect(xys, client);

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 0
  }, "xs started")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "ys started")

  assert.deepEqual(xys.value, [0, 5], "xys.value didn't change")

  send(xs, 1)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs.value changed to 1")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "ys value didn't change")

  assert.deepEqual(xys.value, [1, 5], "xys.value changed")

  send(ys, 6)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "xs.value is still 1")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 6
  }, "ys value changed to 6")

  assert.deepEqual(xys.value, [1, 6], "xys.value changed")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value changed to 2")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 6
  }, "ys value didn't change")

  assert.deepEqual(xys.value, [2, 6], "xys.value changed")

  send(ys, 8)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value didn't change")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 0,
    value: 8
  }, "ys value changed to 8")

  assert.deepEqual(xys.value, [2, 8], "xys.value changed")

  send(ys, Return(5))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "xs.value didn't change")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "ys value changed to 5 & stopped")

  assert.deepEqual(xys.value, [2, 5], "xys.value changed")

  send(xs, 5)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "xs.value changed to 5")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "ys value didn't change")

  assert.deepEqual(xys.value, [5, 5], "xys.value changed")

  send(xs, Return(7))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 7
  }, "stopped and changed xs.value to 7")

  assert.deepEqual(ys.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "ys value didn't change")

  assert.deepEqual(xys.value, [7, 5], "xys.value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [
      [1, 5],
      [1, 6],
      [2, 6],
      [2, 8],
      [2, 5],
      [5, 5],
      [7, 5]
    ],
    errors: [],
    ends: [true]
  }, "all messages received on the client")
}


var count = signal.count
exports["test count"] = function(assert) {
  var xs = new Subject({ value: null })
  var ys = count(xs)

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: null
  }, "source is in initial state")
  assert.equal(ys.value, 0, "counter is at 0")

  var client = new Client()
  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: null
  }, "source is in initial state")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "counter hasn't recevied anything yet")

  assert.equal(ys.value, 0, "counter is at 0")

  send(xs, "a")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "a"
  }, "source vaule changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "counter received message")

  assert.equal(ys.value, 1, "counter incremented")

  send(xs, "b")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "b"
  }, "source vaule changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "counter received message")

  assert.equal(ys.value, 2, "counter incremented")

  send(xs, "c")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "c"
  }, "source vaule changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3],
    errors: [],
    ends: []
  }, "counter received message")

  assert.equal(ys.value, 3, "counter incremented")

  send(xs, new Return("d"))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: "d"
  }, "source vaule changed & stopped")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4],
    errors: [],
    ends: [true]
  }, "counter received message & end")

  assert.equal(ys.value, 4, "counter incremented")
}


var countIf = signal.countIf
exports["test countIf"] = function(assert) {
  var isUpperCase = function(c) {
    return c.toUpperCase() == c
  }

  var xs = new Subject({ value: "B" })
  var ys = countIf(isUpperCase, xs)

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: "B"
  }, "source is in initial state")

  assert.equal(ys.value, 0, "counter value is at 0")

  var client = new Client()
  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "B"
  }, "source is in start state")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages received")

  assert.equal(ys.value, 0, "count is at 0")

  send(xs, "a")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "a"
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages received")

  assert.equal(ys.value, 0, "count is at 0")

  send(xs, "B")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "B"
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(ys.value, 1, "counter incremented")

  send(xs, "C")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "C"
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "message received")

  assert.equal(ys.value, 2, "counter incremented")

  send(xs, "d")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: "d"
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "message wasn't received")

  assert.equal(ys.value, 2, "counter didn't incremented")

  send(xs, new Return("D"))

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: "D"
  }, "source value changed & stopped")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3],
    errors: [],
    ends: [true]
  }, "message & end received")

  assert.equal(ys.value, 3, "counter incremented")
}

var dropRepeats = signal.dropRepeats
exports["test dropRepeats"] = function(assert) {
  var xs = new Subject({ value: 0 })
  var ys = dropRepeats(xs)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 0,
    stopped: 0
  }, "source in initial state")

  assert.equal(ys.value, 0, "filter is in initial state")

  var client = new Client()
  connect(ys, client)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 1,
    stopped: 0
  }, "source started")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages recevied")

  assert.equal(ys.value, 0, "filter is in initial state")

  send(xs, 0)

  assert.deepEqual(xs.toJSON(), {
    value: 0,
    started: 1,
    stopped: 0
  }, "source started")

  assert.deepEqual(client.toJSON(), {
    messages: [],
    errors: [],
    ends: []
  }, "no messages recevied")

  assert.equal(ys.value, 0, "filter is in initial state")

  send(xs, 1)

  assert.deepEqual(xs.toJSON(), {
    value: 1,
    started: 1,
    stopped: 0
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1],
    errors: [],
    ends: []
  }, "messages recevied")

  assert.equal(ys.value, 1, "filter value changed")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "messages recevied")

  assert.equal(ys.value, 2, "filter value changed")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "messages isn't recevied")

  assert.equal(ys.value, 2, "filter value didn't changed")

  send(xs, 2)

  assert.deepEqual(xs.toJSON(), {
    value: 2,
    started: 1,
    stopped: 0
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2],
    errors: [],
    ends: []
  }, "messages isn't recevied")

  assert.equal(ys.value, 2, "filter value didn't changed")

  send(xs, 3)

  assert.deepEqual(xs.toJSON(), {
    value: 3,
    started: 1,
    stopped: 0
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3],
    errors: [],
    ends: []
  }, "messages recevied")

  assert.equal(ys.value, 3, "filter value changed")

  send(xs, 3)

  assert.deepEqual(xs.toJSON(), {
    value: 3,
    started: 1,
    stopped: 0
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3],
    errors: [],
    ends: []
  }, "messages isn't received")

  assert.equal(ys.value, 3, "filter value didn't change")

  send(xs, 4)

  assert.deepEqual(xs.toJSON(), {
    value: 4,
    started: 1,
    stopped: 0
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4],
    errors: [],
    ends: []
  }, "messages recevied")

  assert.equal(ys.value, 4, "filter value changed")

  send(xs, new Return(3))

  assert.deepEqual(xs.toJSON(), {
    value: 3,
    started: 1,
    stopped: 1
  }, "source value changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4, 3],
    errors: [],
    ends: [true]
  }, "messages recevied")

  assert.equal(ys.value, 3, "filter value changed")
}

var keepWhen = signal.keepWhen
exports["test keepWhen"] = function(assert) {
  var setState = function(x) { send(state, x) }
  var setX = function(x) { send(xs, x) }

  var state = new Subject({ value: false })
  var xs = new Subject({ value: 0 })

  var ys = keepWhen(state, 10, xs)

  assert.deepEqual(state.toJSON(), {
    started: 0,
    stopped: 0,
    value: false
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 0
  }, "source is in initial state")

  assert.equal(ys.value, 10, "filter set in inital state")

  var client = new Client()
  connect(ys, client)
  setX(1)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "source value changed")

  assert.equal(ys.value, 10, "filter didn't change")

  setX(2)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source value changed")

  assert.equal(ys.value, 10, "filter didn't change")

  setState(true)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source value didn't change")

  assert.equal(ys.value, 2, "filter changed")


  setX(3)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value changed")

  assert.equal(ys.value, 3, "filter value changed")

  setX(3)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state is on")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value changed")

  assert.equal(ys.value, 3, "filter changed")

  setState(false)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value didn't change")

  assert.equal(ys.value, 3, "filter didn't change")

  setX(4)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value changed")

  assert.equal(ys.value, 3, "filter didn't changed")

  setState(false)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value changed")

  assert.equal(ys.value, 3, "filter changed")

  setState(true)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state is on")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value didn't changed")

  assert.equal(ys.value, 4, "filter changed")

  setState(false)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value didn't changed")

  assert.equal(ys.value, 4, "filter didn't changed")

  setState(new Return(true))

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 1,
    value: true
  }, "state is on & stopped")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value didn't changed")

  assert.equal(ys.value, 4, "filter changed")

  assert.deepEqual(client.toJSON(), {
    messages: [2, 3, 3, 4, 4],
    errors: [],
    ends: []
  }, "received all the messages")

  setX(5)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 1,
    value: true
  }, "state is on & stopped")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "source value changed")

  assert.equal(ys.value, 5, "filter changed")

  setX(Return(5))

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 1,
    value: true
  }, "state is on & stopped")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 5
  }, "source value changed & stopped")

  assert.equal(ys.value, 5, "filter changed")

  assert.deepEqual(client.toJSON(), {
    messages: [2, 3, 3, 4, 4, 5, 5],
    errors: [],
    ends: [true]
  }, "received all the messages & end")
}

var dropWhen = signal.dropWhen
exports["test dropWhen"] = function(assert) {
  var setState = function(x) { send(state, x) }
  var setX = function(x) { send(xs, x) }

  var state = new Subject({ value: false })
  var xs = new Subject({ value: 0 })

  var ys = dropWhen(state, 10, xs)

  assert.deepEqual(state.toJSON(), {
    started: 0,
    stopped: 0,
    value: false
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 0
  }, "source is in initial state")

  assert.equal(ys.value, 0, "filter inherts value as state is false")

  var client = new Client()
  connect(ys, client)
  setX(1)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "source value changed")

  assert.equal(ys.value, 1, "filter changed")

  setX(2)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source value changed")

  assert.equal(ys.value, 2, "filter chnaged")

  setState(true)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state signal changed")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source value didn't change")

  assert.equal(ys.value, 2, "filter didn't change")


  setX(3)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state is true")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value changed")

  assert.equal(ys.value, 2, "filter didn't changed")

  setX(3)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state is on")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value changed")

  assert.equal(ys.value, 2, "filter didn't change")

  setState(false)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value didn't change")

  assert.equal(ys.value, 3, "filter changed")

  setX(4)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value changed")

  assert.equal(ys.value, 4, "filter changed")

  setState(false)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value changed")

  assert.equal(ys.value, 4, "filter changed")

  setState(true)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: true
  }, "state is on")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value didn't changed")

  assert.equal(ys.value, 4, "filter didn't change")

  setState(false)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 0,
    value: false
  }, "state is off")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value didn't changed")

  assert.equal(ys.value, 4, "filter changed")

  setState(new Return(true))

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 1,
    value: true
  }, "state is on & stopped")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 4
  }, "source value didn't changed")

  assert.equal(ys.value, 4, "filter didn't changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4, 4],
    errors: [],
    ends: []
  }, "received all the messages & end")

  setX(5)

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 1,
    value: true
  }, "state is on & stopped")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 5
  }, "source value changed")

  assert.equal(ys.value, 4, "filter didn't changed")

  setX(new Return(6))

  assert.deepEqual(state.toJSON(), {
    started: 1,
    stopped: 1,
    value: true
  }, "state is on & stopped")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 6
  }, "source value changed & source stopped")

  assert.equal(ys.value, 4, "filter didn't changed")

  assert.deepEqual(client.toJSON(), {
    messages: [1, 2, 3, 4, 4],
    errors: [],
    ends: [true]
  }, "received all the messages & end")
}


var sampleOn = signal.sampleOn
exports["test sampleOn"] = function(assert) {
  var ticks = new Subject({ value: null })
  var xs = new Subject({ value: 0 })
  var ys = sampleOn(ticks, xs)

  assert.deepEqual(ticks.toJSON(), {
    started: 0,
    stopped: 0,
    value: null
  }, "ticks is in initial state")

  assert.deepEqual(xs.toJSON(), {
    started: 0,
    stopped: 0,
    value: 0
  }, "source is in initial state")

  assert.deepEqual(ys.value, 0, "sampler inherits initial value from source")

  var client = new Client()

  connect(ys, client)


  assert.deepEqual(ticks.toJSON(), {
    started: 1,
    stopped: 0,
    value: null
  }, "ticks started")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 0
  }, "source started")

  assert.deepEqual(ys.value, 0, "sampler value didn't change")

  send(ticks, null)

  assert.deepEqual(client.toJSON(), {
    messages: [0],
    errors: [],
    ends: []
  }, "client received message")

  send(xs, 2)

  assert.deepEqual(ticks.toJSON(), {
    started: 1,
    stopped: 0,
    value: null
  }, "ticks didn't change")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "source value changed")


  assert.deepEqual(client.toJSON(), {
    messages: [0],
    errors: [],
    ends: []
  }, "client didn't receive message")

  send(xs, 3)

  assert.deepEqual(ticks.toJSON(), {
    started: 1,
    stopped: 0,
    value: null
  }, "ticks didn't change")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value changed")


  assert.deepEqual(client.toJSON(), {
    messages: [0],
    errors: [],
    ends: []
  }, "client didn't received a message")

  send(ticks, 1)

  assert.deepEqual(ticks.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "ticks changed")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 0,
    value: 3
  }, "source value didn't changed")


  assert.deepEqual(client.toJSON(), {
    messages: [0, 3],
    errors: [],
    ends: []
  }, "client received a message")

  send(xs, new Return(4))

  assert.deepEqual(ticks.toJSON(), {
    started: 1,
    stopped: 0,
    value: 1
  }, "ticks didn't change")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 4
  }, "source value changed & stopped")


  assert.deepEqual(client.toJSON(), {
    messages: [0, 3],
    errors: [],
    ends: []
  }, "client didn't received message")

  send(ticks, 2)

  assert.deepEqual(ticks.toJSON(), {
    started: 1,
    stopped: 0,
    value: 2
  }, "ticks didn't change")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 4
  }, "source value didn't change")


  assert.deepEqual(client.toJSON(), {
    messages: [0, 3, 4],
    errors: [],
    ends: []
  }, "client received message")

  send(ticks, new Return(3))

  assert.deepEqual(ticks.toJSON(), {
    started: 1,
    stopped: 1,
    value: 3
  }, "ticks changed")

  assert.deepEqual(xs.toJSON(), {
    started: 1,
    stopped: 1,
    value: 4
  }, "source value didn't change")


  assert.deepEqual(client.toJSON(), {
    messages: [0, 3, 4, 4],
    errors: [],
    ends: [true]
  }, "client received message and ended")
}
