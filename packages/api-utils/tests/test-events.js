/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { EventEmitter } = require('api-utils/events');
const { emit, off } = require('api-utils/event/core')

exports['test:add listeners'] = function(test) {
  let e = new EventEmitter();

  let events_new_listener_emited = [];
  let times_hello_emited = 0;

  e.on("newListener", function (event, listener) {
    events_new_listener_emited.push(event)
  })

  e.on("hello", function (a, b) {
    times_hello_emited += 1
    test.assertEqual("a", a)
    test.assertEqual("b", b)
    test.assertEqual(this, e, '`this` pseudo-variable is bound to instance');
  })

  emit(e, "hello", "a", "b")
};

exports['test:removeListener'] = function(test) {
  let count = 0;

  function listener1 () {
    count++;
  }
  function listener2 () {
    count++;
  }

  // test adding and removing listener
  let e1 = new EventEmitter();
  e1.on("hello", listener1);
  e1.removeListener("hello", listener1);
  emit(e1, "hello", "");
  test.assertEqual(0, count);

  // test adding one listener and removing another which was not added
  let e2 = new EventEmitter();
  e2.on("hello", listener1);
  e2.removeListener("hello", listener2);
  emit(e2, "hello", "");
  test.assertEqual(1, count);

  // test adding 2 listeners, and removing one
  let e3 = new EventEmitter();
  e3.on("hello", listener1);
  e3.on("hello", listener2);
  e3.removeListener("hello", listener1);
  emit(e3, "hello", "");
  test.assertEqual(2, count);
};

exports['test:removeAllListeners'] = function(test) {
  let count = 0;

  function listener1 () {
    count++;
  }
  function listener2 () {
    count++;
  }

  // test adding a listener and removing all of that type
  let e1 = new EventEmitter();
  e1.on("hello", listener1);
  off(e1, "hello");
  emit(e1, "hello", "");
  test.assertEqual(0, count);

  // test adding a listener and removing all of another type
  let e2 = new EventEmitter();
  e2.on("hello", listener1);
  off(e2, 'goodbye');
  emit(e2, "hello", "");
  test.assertEqual(1, count);

  // test adding 1+ listeners and removing all of that type
  let e3 = new EventEmitter();
  e3.on("hello", listener1);
  e3.on("hello", listener2);
  off(e3, "hello");
  emit(e3, "hello", "");
  test.assertEqual(1, count);

  // test adding 2 listeners for 2 types and removing all listeners
  let e4 = new EventEmitter();
  e4.on("hello", listener1);
  e4.on('goodbye', listener2);
  emit(e4, "goodbye", "");
  off(e4);
  emit(e4, "hello", "");
  emit(e4, "goodbye", "");
  test.assertEqual(2, count);
};

exports['test: modify in emit'] = function(test) {
  let callbacks_called = [ ];
  let e = new EventEmitter();

  function callback1() {
    callbacks_called.push("callback1");
    e.on("foo", callback2);
    e.on("foo", callback3);
    e.removeListener("foo", callback1);
  }
  function callback2() {
    callbacks_called.push("callback2");
    e.removeListener("foo", callback2);
  }
  function callback3() {
    callbacks_called.push("callback3");
    e.removeListener("foo", callback3);
  }

  e.on("foo", callback1);

  emit(e, "foo");
  test.assertEqual(1, callbacks_called.length);
  test.assertEqual('callback1', callbacks_called[0]);

  emit(e, "foo");
  test.assertEqual(3, callbacks_called.length);
  test.assertEqual('callback1', callbacks_called[0]);
  test.assertEqual('callback2', callbacks_called[1]);
  test.assertEqual('callback3', callbacks_called[2]);

  emit(e, "foo");
  test.assertEqual(3, callbacks_called.length);
  test.assertEqual('callback1', callbacks_called[0]);
  test.assertEqual('callback2', callbacks_called[1]);
  test.assertEqual('callback3', callbacks_called[2]);

  e.on("foo", callback1);
  e.on("foo", callback2);
  off(e, "foo");

  // Verify that removing callbacks while in emit allows emits to propagate to
  // all listeners
  callbacks_called = [ ];

  e.on("foo", callback2);
  e.on("foo", callback3);
  emit(e, "foo");
  test.assertEqual(2, callbacks_called.length);
  test.assertEqual('callback2', callbacks_called[0]);
  test.assertEqual('callback3', callbacks_called[1]);
};

exports['test:adding same listener'] = function(test) {
  let called = 0;
  function foo() { called ++; }
  let e = new EventEmitter();
  e.on("foo", foo);
  e.on("foo", foo);

  emit(e, "foo");

  test.assertEqual(called, 1, 'same listener is registered only once');
}

exports['test:errors are reported if listener throws'] = function(test) {
  let e = new EventEmitter(),
      reported = false;
  e.on('error', function(e) reported = true)
  e.on('boom', function() { throw new Error('Boom!') });
  emit(e, 'boom', 3);
  test.assert(reported, 'error should be reported through event');
};

exports['test:emitOnObject'] = function(test) {
  let e = new EventEmitter();

  e.on("foo", function() {
    test.assertEqual(this, e, "`this` should be emitter");
  });
  emit(e, "foo");
};

exports['test:once'] = function(test) {
  let e = new EventEmitter();
  let called = false;

  e.once('foo', function(value) {
    test.assert(!called, "listener called only once");
    test.assertEqual(value, "bar", "correct argument was passed");
  });

  emit(e, 'foo', 'bar');
  emit(e, 'foo', 'baz');
};

exports["test:removing once"] = function(test) {
  let e = require("events").EventEmitterTrait.create();
  e.once("foo", function() { test.pass("listener was called"); });
  e.once("error", function() { test.fail("error event was emitted"); });
  emit(e, "foo", "bug-656684");
};
