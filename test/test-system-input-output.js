/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";


const self = require("sdk/self");
const { Cc, Ci, Cu } = require("chrome");
const { Loader, LoaderWithHookedConsole2 } = require("sdk/test/loader");
const nsIObserverService = Cc["@mozilla.org/observer-service;1"].
                           getService(Ci.nsIObserverService);
const { InputPort } = require("sdk/input/system");
const { OutputPort } = require("sdk/output/system");

const { lift, start, stop, send, keepWhen } = require("sdk/input/signal");

const isConsoleEvent = topic =>
  ["console-api-log-event",
   "console-storage-cache-event"].indexOf(topic) >= 0;

const message = x => ({wrappedJSObject: {data: x}});

exports["test start / stop ports"] = assert => {
  const input = new InputPort({ id: Date.now().toString(32), initial: {data:0} });
  const topic = input.topic;

  const xs = lift(({data}) => "x:" + data, input);
  const ys = lift(({data}) => "y:" + data, input);

  assert.deepEqual(input.value, {data:0}, "initila value is set");
  assert.deepEqual(xs.value, "x:0", "initial value is mapped");
  assert.deepEqual(ys.value, "y:0", "initial value is mapped");

  nsIObserverService.notifyObservers(message(1), topic, null);

  assert.deepEqual(input.value, {data:0}, "no message received on input port");
  assert.deepEqual(xs.value, "x:0", "no message received on xs");
  assert.deepEqual(ys.value, "y:0", "no message received on ys");

  start(xs);


  nsIObserverService.notifyObservers(message(2), topic, null);

  assert.deepEqual(input.value, {data:2}, "message received on input port");
  assert.deepEqual(xs.value, "x:2", "message received on xs");
  assert.deepEqual(ys.value, "y:0", "no message received on (not started) ys");

  start(ys);

  nsIObserverService.notifyObservers(message(3), topic, null);


  assert.deepEqual(input.value, {data:3}, "message received on input port");
  assert.deepEqual(xs.value, "x:3", "message received on xs");
  assert.deepEqual(ys.value, "y:3", "message received on ys");

  stop(xs);

  nsIObserverService.notifyObservers(message(4), topic, null);

  assert.deepEqual(input.value, {data:4}, "message received on input port");
  assert.deepEqual(xs.value, "x:3", "message not received on (stopped) xs");
  assert.deepEqual(ys.value, "y:4", "message received on ys");

  start(xs);

  nsIObserverService.notifyObservers(message(5), topic, null);

  assert.deepEqual(input.value, {data:5}, "message received on input port");
  assert.deepEqual(xs.value, "x:5", "message not received on xs");
  assert.deepEqual(ys.value, "y:5", "message received on ys");

  stop(ys);

  nsIObserverService.notifyObservers(message(6), topic, null);

  assert.deepEqual(input.value, {data:6}, "message received on input port");
  assert.deepEqual(xs.value, "x:6", "message not received on xs");
  assert.deepEqual(ys.value, "y:5", "message not received on (stopped) ys");

  stop(xs);

  nsIObserverService.notifyObservers(message(7), topic, null);

  assert.deepEqual(input.value, {data:6}, "message note received on input port");
  assert.deepEqual(xs.value, "x:6", "message not received on (stopped) xs");
  assert.deepEqual(ys.value, "y:5", "message not received on (stopped) ys");
};

exports["test send messages to nsIObserverService"] = assert => {
  let messages = [];

  const { newURI } = Cc['@mozilla.org/network/io-service;1'].
                       getService(Ci.nsIIOService);

  const output = new OutputPort({ id: Date.now().toString(32) });
  const topic = output.topic;

  const observer = {
    QueryInterface: function() {
      return this;
    },
    observe: (subject, topic, data) => {
      // Ignores internal console events
      if (!isConsoleEvent(topic)) {
        messages.push({
          topic: topic,
          subject: subject
        });
      }
    }
  };

  nsIObserverService.addObserver(observer, topic, false);

  send(output, null);
  assert.deepEqual(messages.shift(), { topic: topic, subject: null },
                   "null message received");


  const uri = newURI("http://www.foo.com", null, null);
  send(output, uri);

  assert.deepEqual(messages.shift(), { topic: topic, subject: uri },
                   "message received");


  function customSubject() {}
  send(output, customSubject);

  let message = messages.shift();
  assert.equal(message.topic, topic, "topic was received");
  assert.equal(message.subject.wrappedJSObject, customSubject,
               "custom subject is received");

  nsIObserverService.removeObserver(observer, topic);

  send(output, { data: "more data" });

  assert.deepEqual(messages, [],
                   "no more data received");

  nsIObserverService.addObserver(observer, "*", false);

  send(output, { data: "data again" });

  message = messages.shift();
  assert.equal(message.topic, topic, "topic was received");
  assert.deepEqual(message.subject.wrappedJSObject,
                   { data: "data again" },
                   "wrapped message received");

  nsIObserverService.removeObserver(observer, "*");

  send(output, { data: "last data" });
  assert.deepEqual(messages, [],
                   "no more data received");

  assert.throws(() => send(output, "hi"),
                /Unsupproted message type: `string`/,
                "strings can't be send");

  assert.throws(() => send(output, 4),
                /Unsupproted message type: `number`/,
                "numbers can't be send");

  assert.throws(() => send(output, void(0)),
                /Unsupproted message type: `undefined`/,
                "undefineds can't be send");

  assert.throws(() => send(output, true),
                /Unsupproted message type: `boolean`/,
                "booleans can't be send");
};
/*

exports["test auto observer remove"] = assert => {
  const dataTopic = "data:" + Date.now().toString(32);
  const toggleTopic = "toggle:" + Date.now().toString(32);

  const dataChannel = new NotificationChannel(dataTopic);
  const toggleChannel = new NotificationChannel(toggleTopic);

  const data = new ObserverNotifications(dataTopic, 0);
  const isOn = new ObserverNotifications(toggleTopic, true);

  const xs = keepWhen(isOn, null, data);
  start(xs);

  assert.deepEqual(xs.value, 0,
                   "inherit value from data since isOn.value is true");

  send(dataChannel, 1);

  assert.deepEqual(data.value, 1,
                   "received notification");
  assert.deepEqual(xs.value, 1,
                   "received data");

  send(dataChannel, 2);

  assert.deepEqual(data.value, 2,
                   "received notification");
  assert.deepEqual(xs.value, 2,
                   "received more data");

  send(toggleChannel, false);

  assert.deepEqual(isOn.value, false,
                   "switched off");

  send(dataChannel, 3);

  assert.deepEqual(xs.value, 2,
                   "no data received");

  assert.deepEqual(data.value, 3,
                   "notification received");
};

exports["test subject wrap / unwrap"] = function (assert) {
  const topic = Date.now().toString(32);
  const channel = new NotificationChannel(topic);
  const input = new ObserverNotifications(topic, null);

  start(input);

  [true, false, 100, 0, "a string", "", null, void(0), {}].forEach(x => {
    send(channel, x);
    assert.equal(input.value, x, "send data (" + x + ") was received");
  });

  stop(input);
};

exports["test error reporting"] = function(assert) {
  let { loader, messages } = LoaderWithHookedConsole2(module);
  const { start, stop, lift } = loader.require("sdk/input/signal");
  const { NotificationChannel,
          ObserverNotifications } = loader.require("sdk/input/observer-notification");
  const topic = "error:" + Date.now().toString(32);

  const raise = x => { if (x) throw new Error("foo"); };

  let lineNumber;
  try {
    brokenHandler();
  } catch (error) {
    lineNumber = error.lineNumber
  }

  const channel = new NotificationChannel(topic);
  const source = new ObserverNotifications(topic, null);
  const input = lift(raise, source);

  assert.equal(input.value, null, "initial inherited");

  send(channel, { data: "yo yo" });

  assert.deepEqual(messages, [], "nothing happend yet");

  start(input);

  send(channel, { data: "first" });

  assert.equal(messages.length, 4, "Got an exception");


  assert.equal(messages[0], "console.error: " + self.name + ": \n",
               "error is logged");

  assert.ok(/Unhandled error/.test(messages[1]),
            "expected error message");

  loader.unload();
};


exports["test inputs are GC-ed"] = function(assert, done) {
  const loader = Loader(module);
  const { start, stop, lift } = loader.require("sdk/input/signal");
  const { NotificationChannel,
          ObserverNotifications } = loader.require("sdk/input/observer-notification");


  const topic = "GC:" + Date.now().toString(32);

  const channel = new NotificationChannel(topic);

  let messages = [];
  let source = new ObserverNotifications(topic, { data: 0 });
  let input = lift(x => messages.push(x), source);

  start(input);
  send(channel, { data: 1 });
  assert.deepEqual(messages, [
    { data: 0 },
    { data: 1 }
  ], "message received");

  input = null;
  source = null;

  Cu.schedulePreciseGC(function() {
    send(channel, { data: 2 });

    assert.deepEqual(messages, [
      { data: 0 },
      { data: 1 }
    ], "message isn't received");

    loader.unload();
    done();
  });
};
*/

require("sdk/test").run(exports);
