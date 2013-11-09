/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const self = require("sdk/self");
const { Cc, Ci, Cu } = require("chrome");
const { Loader, LoaderWithHookedConsole2 } = require("sdk/test/loader");
const nsIObserverService = Cc["@mozilla.org/observer-service;1"].
                           getService(Ci.nsIObserverService);
const { ObserverNotifications,
        NotificationChannel } = require("sdk/input/observer-notification");

const { lift, start, stop, send, keepWhen } = require("sdk/input/signal");

const isConsoleEvent = topic =>
  ["console-api-log-event",
   "console-storage-cache-event"].indexOf(topic) >= 0

exports["test receive messages"] = assert => {
  const topic = Date.now().toString(32);
  const input = new ObserverNotifications(topic, {
    wrappedJSObject: { data: null }
  });

  const xs = lift(e => e.wrappedJSObject, input);
  const ys = lift(x => x.data, xs);
  const zs = lift(x => x.data + "!", xs);

  assert.deepEqual(xs.value, { data: null },
                   "inherit initial value")

  assert.deepEqual(ys.value, null,
                  "inherit initial vaule")

  nsIObserverService.notifyObservers({
    wrappedJSObject: { data: "???" }
  }, topic, null);

  assert.deepEqual(xs.value, { data: null },
                   "no message received since xs isn't started");

  start(xs);


  nsIObserverService.notifyObservers({
    wrappedJSObject: { data: "foo" }
  }, topic, null);


  assert.deepEqual(xs.value, { data: "foo" },
                   "message received");

  assert.deepEqual(ys.value, null,
                   "no message on ys since itsn't started");

  start(ys);

  nsIObserverService.notifyObservers({
    wrappedJSObject: { data: "bar" }
  }, topic, null);

  assert.deepEqual(xs.value, { data: "bar" },
                   "message received on xs");

  assert.deepEqual(ys.value, "bar",
                   "message received on ys");

  stop(xs);

  nsIObserverService.notifyObservers({
    wrappedJSObject: { data: "baz" }
  }, topic, null);

  assert.deepEqual(xs.value, { data: "bar" },
                   "no message received on xs");

  assert.deepEqual(ys.value, "bar",
                   "no message received on ys since it derives from xs");

  assert.deepEqual(input.value.wrappedJSObject, { data: "bar" },
                   "observer was stopped as well");

  start(xs);

  nsIObserverService.notifyObservers({
    wrappedJSObject: { data: "beep" }
  }, topic, null);

  assert.deepEqual(xs.value, { data: "beep" },
                   "message received on xs");

  assert.deepEqual(ys.value, "beep",
                   "message received on ys");

  stop(ys);

  nsIObserverService.notifyObservers({
    wrappedJSObject: { data: "bop" }
  }, topic, null);

  assert.deepEqual(xs.value, { data: "beep" },
                   "message isnt't received on xs since ys was only handler");

  assert.deepEqual(ys.value, "beep",
                   "message isn't received on ys");

  start(zs);

  nsIObserverService.notifyObservers({
    wrappedJSObject: { data: "qux" }
  }, topic, null);

  assert.deepEqual(xs.value, { data: "qux" },
                   "message received on xs");

  assert.deepEqual(ys.value, "beep",
                   "message isn't received on ys");

  assert.deepEqual(zs.value, "qux!",
                   "message received on zs");

  stop(input);
};

exports["test send messages to nsIObserverService"] = assert => {
  let messages = [];

  const { newURI } = Cc['@mozilla.org/network/io-service;1'].
                       getService(Ci.nsIIOService);
  const topic = Date.now().toString(32);
  const channel = new NotificationChannel(topic);

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

  const uri = newURI("http://www.foo.com", null, null);
  send(channel, uri);

  assert.deepEqual(messages.shift(), { topic: topic, subject: uri },
                   "message received");


  function customSubject() {}
  send(channel, customSubject);

  let message = messages.shift()
  assert.equal(message.topic, topic, "topic was received");
  assert.equal(message.subject.wrappedJSObject.object, customSubject,
               "custom subject is received");

  nsIObserverService.removeObserver(observer, topic);

  send(channel, { data: "more data" });

  assert.deepEqual(messages, [],
                   "no more data received");

  nsIObserverService.addObserver(observer, "*", false);

  send(channel, { data: "data again" });

  let message = messages.shift();
  assert.equal(message.topic, topic, "topic was received");
  assert.deepEqual(message.subject.wrappedJSObject.object,
                   { data: "data again" },
                   "wrapped message received");

  nsIObserverService.removeObserver(observer, "*");

  send(channel, { data: "last data" });
  assert.deepEqual(messages, [],
                   "no more data received");
};

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

require("sdk/test").run(exports);
