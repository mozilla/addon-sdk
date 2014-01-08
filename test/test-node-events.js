/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { emit } = require('sdk/event/core');
const { EventEmitter } = require('node/events');
const { Loader } = require('sdk/test/loader');

exports['test EventEmitter#emit()'] = function (assert, done) {
  let target = EventEmitter();

  target.on('message', function (...args) {
    assert.equal(args[0], 'sonic', 'arguments in target.emit are correct');
    assert.equal(args[1], 'the', 'arguments in target.emit are correct');
    assert.equal(args[2], 'hedgehog', 'arguments in target.emit are correct');
    done();
  });

  target.emit('message', 'sonic', 'the', 'hedgehog');
};

exports['test EventEmitter#emit() returns true/false for listeners'] = function (assert) {
  let target = EventEmitter();

  target.on('message1', () => {});
  target.on('message2', () => {});

  assert.equal(target.emit('message1'), true, 'returns true if listeners exist');
  assert.equal(target.emit('message2'), true, 'returns true if listeners exist');
  assert.equal(target.emit('message3'), false, 'returns false if listeners not exist');

  target.on('*', () => {});
  assert.equal(target.emit('message3'), true, 'returns true if * used and any listener exists');
};

exports['test EventEmitter#once()'] = function (assert) {
  let target = EventEmitter();
  let count = 0;

  target.once('message', function (a, b) {
    count++;
    assert.equal(a, 'a', '`once` receives arguments correctly');
    assert.equal(b, 'b', '`once` receives arguments correctly');
  });

  target.emit('message', 'a', 'b');
  target.emit('message', 'a', 'b');
  target.emit('message', 'a', 'b');
};

exports['test EventEmitter#on()'] = function(assert) {
  let events = [ { name: 'event#1' }, 'event#2' ];
  let target = EventEmitter();

  target.on('message', function(message) {
    assert.equal(this, target, 'this is a target object');
    assert.equal(message, events.shift(), 'message is emitted event');
  });

  emit(target, 'message', events[0]);
  emit(target, 'message', events[0]);
};

exports['test EventEmitter#addListener()'] = function(assert) {
  let events = [ { name: 'event#1' }, 'event#2' ];
  let target = EventEmitter();

  target.addListener('message', function(message) {
    assert.equal(this, target, 'this is a target object');
    assert.equal(message, events.shift(), 'message is emitted event');
  });

  emit(target, 'message', events[0]);
  emit(target, 'message', events[0]);
};

exports['test EventEmitter#removeListener()'] = function(assert) {
  let target = EventEmitter();
  let actual = [];
  target.on('message', function listener() {
    actual.push(1);
    target.on('message', function() {
      target.removeListener('message', listener);
      actual.push(2);
    });
  });

  target.off('message'); // must do nothing.
  emit(target, 'message');
  assert.deepEqual([ 1 ], actual, 'first listener called');
  emit(target, 'message');
  assert.deepEqual([ 1, 1, 2 ], actual, 'second listener called');
  emit(target, 'message');
  assert.deepEqual([ 1, 1, 2, 2, 2 ], actual, 'first listener removed');
};

exports['test EventEmitter#removeAllListeners()'] = function (assert) {
  let target = EventEmitter();
  let count = 0;
  target.on('ev1', () => count += 1);
  target.on('ev2', () => count += 2);
  target.on('ev3', () => count += 3);
  target.on('ev1', () => count += 10);
  target.on('ev2', () => count += 20);
  target.on('ev3', () => count += 30);

  target
    .removeAllListeners() // Test chaining too here
    .emit('ev1');
  target.emit('ev2');
  target.emit('ev3');

  assert.equal(count, 0, 'removeAllListeners() removes all listeners of all types');
  target.on('ev1', () => count += 1);
  target.on('ev2', () => count += 2);
  target.on('ev3', () => count += 3);
  target.on('ev1', () => count += 10);
  target.on('ev2', () => count += 20);
  target.on('ev3', () => count += 30);

  target
    .removeAllListeners('ev2')
    .emit('ev1');
  target.emit('ev2');
  target.emit('ev3');

  assert.equal(count, 44, 'removeAllListeners(type) removes all listeners of `type`');
};

exports['test EventEmitter#listeners()'] = function (assert) {
  let target = EventEmitter();

  let noop1 = (x) => x;
  let noop2 = (x) => x;
  let noop3 = (x) => x;

  target.on('ev1', noop1);
  target.on('ev1', noop2);
  target.on('ev2', noop3);
  target.on('ev2', noop1);

  assert.equal(target.listeners('ev1').length, 2, 'correct length array returned');
  assert.equal(target.listeners('ev2').length, 2, 'correct length array returned');
  assert.ok(~target.listeners('ev1').indexOf(noop1), 'correct listener in array');
  assert.ok(~target.listeners('ev1').indexOf(noop2), 'correct listener in array');
  assert.ok(~target.listeners('ev2').indexOf(noop1), 'correct listener in array');
  assert.ok(~target.listeners('ev2').indexOf(noop3), 'correct listener in array');
};

exports['test context of listeners'] = function (assert) {
  let target = EventEmitter();

  target.on('e', function (...args)  {
    assert.equal(this, target, '`this` in listener is target');
  });

  target.emit('e');
};

exports['test pass in listeners'] = function(assert) {
  let actual = [ ];
  let target = EventEmitter({
    onMessage: function onMessage(message) {
      assert.equal(this, target, 'this is an event target');
      actual.push(1);
    },
    onFoo: null,
    onbla: function() {
      assert.fail('`onbla` is not supposed to be called');
    }
  });
  target.on('message', function(message) {
    assert.equal(this, target, 'this is an event target');
    actual.push(2);
  });

  emit(target, 'message');
  emit(target, 'missing');

  assert.deepEqual([ 1, 2 ], actual, 'all listeners trigerred in right order');
};

exports['test that listener is unique per type'] = function(assert) {
  let actual = []
  let target = EventEmitter();
  function listener() { actual.push(1) }
  target.on('message', listener);
  target.on('message', listener);
  target.on('message', listener);
  target.on('foo', listener);
  target.on('foo', listener);

  emit(target, 'message');
  assert.deepEqual([ 1 ], actual, 'only one message listener added');
  emit(target, 'foo');
  assert.deepEqual([ 1, 1 ], actual, 'same listener added for other event');
};

exports['test event type matters'] = function(assert) {
  let target = EventEmitter();
  target.on('message', function() {
    assert.fail('no event is expected');
  });
  target.on('done', function() {
    assert.pass('event is emitted');
  });

  emit(target, 'foo');
  emit(target, 'done');
};

exports['test all arguments are pasesd'] = function(assert) {
  let foo = { name: 'foo' }, bar = 'bar';
  let target = EventEmitter();
  target.on('message', function(a, b) {
    assert.equal(a, foo, 'first argument passed');
    assert.equal(b, bar, 'second argument passed');
  });
  emit(target, 'message', foo, bar);
};

exports['test no side-effects in emit'] = function(assert) {
  let target = EventEmitter();
  target.on('message', function() {
    assert.pass('first listener is called');
    target.on('message', function() {
      assert.fail('second listener is called');
    });
  });
  emit(target, 'message');
};

exports['test order of propagation'] = function(assert) {
  let actual = [];
  let target = EventEmitter();
  target.on('message', function() { actual.push(1); });
  target.on('message', function() { actual.push(2); });
  target.on('message', function() { actual.push(3); });
  emit(target, 'message');
  assert.deepEqual([ 1, 2, 3 ], actual, 'called in order they were added');
};

exports['test error handling'] = function(assert) {
  let target = EventEmitter();
  let error = Error('boom!');

  target.on('message', function() { throw error; })
  target.on('error', function(boom) {
    assert.equal(boom, error, 'thrown exception causes error event');
  });
  emit(target, 'message');
};

exports['test unhandled errors'] = function(assert) {
  let exceptions = [];
  let loader = Loader(module);
  let { emit } = loader.require('sdk/event/core');
  let { EventEmitter } = loader.require('node/events');
  Object.defineProperties(loader.sandbox('sdk/event/core'), {
    console: { value: {
      exception: function(e) {
        exceptions.push(e);
      }
    }}
  });
  let target = EventEmitter();
  let boom = Error('Boom!');
  let drax = Error('Draax!!');

  target.on('message', function() { throw boom; });

  emit(target, 'message');
  assert.ok(~String(exceptions[0]).indexOf('Boom!'),
            'unhandled exception is logged');

  target.on('error', function() { throw drax; });
  emit(target, 'message');
  assert.ok(~String(exceptions[1]).indexOf('Draax!'),
            'error in error handler is logged');
};

exports['test target is chainable'] = function (assert, done) {
  let loader = Loader(module);
  let exceptions = [];
  let { EventEmitter } = loader.require('node/events');
  let { emit } = loader.require('sdk/event/core');
  Object.defineProperties(loader.sandbox('sdk/event/core'), {
    console: { value: {
      exception: function(e) {
        exceptions.push(e);
      }
    }}
  });

  let emitter = EventEmitter();
  let boom = Error('Boom');
  let onceCalled = 0;

  emitter.once('oneTime', function () {
    assert.equal(++onceCalled, 1, 'once event called only once');
  }).on('data', function (message) {
    assert.equal(message, 'message', 'handles event');
    emit(emitter, 'oneTime');
    emit(emitter, 'data2', 'message2');
  }).on('phony', function () {
    assert.fail('removeListener does not remove chained event');
  }).removeListener('phony')
  .on('data2', function (message) {
    assert.equal(message, 'message2', 'handle chained event');
    emit(emitter, 'oneTime');
    throw boom;
  }).on('error', function (error) {
    assert.equal(error, boom, 'error handled in chained event');
    done();
  });

  emit(emitter, 'data', 'message');
};

exports['test EventEmitter.listenerCount()'] = function (assert) {
  let target1 = EventEmitter();
  let target2 = EventEmitter();

  target1.on('msg1', () => {});
  target1.on('msg1', () => {});
  target1.on('msg2', () => {});

  assert.equal(EventEmitter.listenerCount(target1, 'msg1'), 2, 'correct listenerCount()');
  assert.equal(EventEmitter.listenerCount(target1, 'msg2'), 1, 'correct listenerCount()');
  assert.equal(EventEmitter.listenerCount(target1, 'msg3'), 0, 'correct listenerCount()');
  assert.equal(EventEmitter.listenerCount(target2, 'msg1'), 0, 'correct listenerCount()');
};

exports['test EventEmitter event "newListener"'] = function (assert) {
  let target1 = EventEmitter();
  let target2 = EventEmitter();
  let count = [];
  let noop1 = () => {};
  let noop2 = () => {};

  target1.on('newListener', (name, listener) => {
    count.push(name);
    if (name === 'onelistener')
      assert.equal(listener, noop1, 'correct listener passed in as argument');
    if (name === 'twolistener')
      assert.equal(listener, noop2, 'correct listener passed in as argument');
  });

  target1.on('onelistener', noop1);
  target1.on('twolistener', noop2);
  target2.on('onelistener', noop1);

  assert.equal(count.length, 2, 'newListener fired correct amount of times');
  assert.equal(count[0], 'onelistener', 'correct event name passed in');
  assert.equal(count[1], 'twolistener', 'correct event name passed in');
};

exports['test EventEmitter event "removeListener"'] = function (assert) {
  let target1 = EventEmitter();
  let count = 0;
  let noop1 = () => {};

  target1.on('removeListener', (name, listener) => {
    count++;
    assert.equal(name, 'onelistener', 'correct event name');
    assert.equal(listener, noop1, 'correct listener');
  });

  target1.on('onelistener', noop1);
  assert.equal(count, 0, 'not fired before removal');
  target1.off('onelistener', noop1);
  assert.equal(count, 1, 'fired after removal');
};

exports['test EventEmitter event "removeListener" with removeAllListener(name)'] = function (assert) {
  let target1 = EventEmitter();
  let count = [];
  let noop1 = () => {};
  let noop2 = () => {};
  let noop3 = () => {};

  target1.on('removeListener', (name, listener) => {
    count.push(listener);
    assert.equal(name, 'onelistener', 'only fire removeListener for correct event name');
  });

  target1.on('onelistener', noop1);
  target1.on('twolistener', noop2);
  target1.on('onelistener', noop3);

  assert.equal(count.length, 0, 'not fired before removal');
  target1.removeAllListeners('onelistener');
  assert.equal(count.length, 2, 'fired after removal');
  assert.ok(~count.indexOf(noop1), 'passed in appropriate listener');
  assert.ok(~count.indexOf(noop3), 'passed in appropriate listener');
};

exports['test EventEmitter event "removeListener" with removeAllListener()'] = function (assert) {
  let target1 = EventEmitter();
  let count = {};
  let noop1 = () => {};
  let noop2 = () => {};
  let noop3 = () => {};

  console.log('GOING');
  target1.on('removeListener', (name, listener) => {
    console.log('removeListener!!!',name,listener);
    if (!count[name])
      count[name] = [];
    count[name].push(listener);
  });

  target1.on('onelistener', noop1);
  target1.on('twolistener', noop2);
  target1.on('onelistener', noop3);

  target1.removeAllListeners();
  assert.equal(count['onelistener'].length, 2);
  assert.equal(count['twolistener'].length, 1);
  assert.equal(count['twolistener'][0], noop2);
  assert.equal(count['onelistener'][0], noop1);
  assert.equal(count['onelistener'][1], noop3);
};

require('test').run(exports);

