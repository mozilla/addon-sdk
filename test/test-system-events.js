/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const events = require("sdk/system/events");
const self = require("sdk/self");
const { Cc, Ci, Cu } = require("chrome");
const { setTimeout } = require("sdk/timers");
const { Loader } = require("sdk/test/loader");
const { PlainTextConsole } = require("sdk/console/plain-text");
const nsIObserverService = Cc["@mozilla.org/observer-service;1"].
                           getService(Ci.nsIObserverService);

exports["test error reporting"] = function(assert) {
  let prints = [];
  let loader = Loader(module, {
    console: new PlainTextConsole(function(_) {
      prints.push(_);
    })
  });

  let events = loader.require("sdk/system/events");
  let type = Date.now().toString(32);

  let timesCalled = 0;
  function handler(subject, data) { timesCalled++; };
  function brokenHandler(subject, data) { throw new Error("foo"); };

  let lineNumber;
  try { brokenHandler() } catch (error) { lineNumber = error.lineNumber }



  events.on(type, handler);
  events.emit(type, { data: "yo yo" });

  assert.equal(timesCalled, 1, "event handler was called");

  events.off(type, handler);
  events.emit(type, { data: "no way" });

  assert.equal(timesCalled, 1, "removed handler is no longer called");

  events.once(type, handler);
  events.emit(type, { data: "and we meet again" });
  events.emit(type, { data: "it's always hard to say bye" });

  assert.equal(timesCalled, 2, "handlers added via once are triggered once");

  let errorType = Date.now().toString(32);

  events.on(errorType, brokenHandler);
  events.emit(errorType, { data: "yo yo" });

  let lines = prints[0].split("\n");

  assert.equal(lines[0], "error: " + self.name + ": An exception occurred.",
               "error is logged");
  assert.equal(lines[1], "Error: foo", "error message is logged")

  assert.equal(lines[2], module.uri + " " + lineNumber, "error line is logged");
  assert.equal(lines[3], "Traceback (most recent call last):",
               "stack trace is logged");

  events.off(errorType, brokenHandler);

  loader.unload();
};

exports["test listeners are GC-ed"] = function(assert, done) {
  let received = [];
  let type = Date.now().toString(32);
  function handler(event) { received.push(event); }
  function weakHandler(event) { received.push(event); }

  events.on(type, handler, true);
  events.on(type, weakHandler);

  events.emit(type, { data: 1 });
  assert.equal(received.length, 2, "both handlers are invoked");

  handler = weakHandler = null;

  setTimeout(function() {
    Cu.forceGC();
    events.emit(type, { data: 2 });
    assert.equal(received.length, 3, "only handler with strong ref is invoked");
    done();
  }, 300);
};

exports["test handle nsIObserverService notifications"] = function(assert) {
  let ios = Cc['@mozilla.org/network/io-service;1']
            .getService(Ci.nsIIOService);

  let uri = ios.newURI("http://www.foo.com", null, null);

  let type = Date.now().toString(32);
  let timesCalled = 0;
  let lastSubject = null;
  let lastData = null;
  let lastType = null;

  function handler({ subject, data, type }) {
    timesCalled++;
    lastSubject = subject;
    lastData = data;
    lastType = type;
  };

  events.on(type, handler);
  nsIObserverService.notifyObservers(uri, type, "some data");

  assert.equal(timesCalled, 1, "notification invokes handler");
  assert.equal(lastType, type, "event.type is notification topic");
  assert.equal(lastSubject, uri, "event.subject is notification subject");
  assert.equal(lastData, "some data", "event.data is notification data");

  function customSubject() {}
  function customData() {}

  events.emit(type, { data: customData, subject: customSubject });

  assert.equal(timesCalled, 2, "notification invokes handler");
  assert.equal(lastType, type, "event.type is notification topic");
  assert.equal(lastSubject, customSubject,
               "event.subject is wrapped & unwrapped");
  assert.equal(lastData, customData, "event.data is wrapped & unwrapped");

  events.off(type, handler);

  nsIObserverService.notifyObservers(null, type, "some data");

  assert.equal(timesCalled, 2, "event handler is removed");

  events.on("*", handler);

  nsIObserverService.notifyObservers(null, type, "more data");

  assert.equal(timesCalled, 3, "notification invokes * handler");
  assert.equal(lastType, type, "event.type is notification topic");
  assert.equal(lastSubject, null,
               "event.subject is notification subject");
  assert.equal(lastData, "more data", "event.data is notification data");

  events.off("*", handler);

  nsIObserverService.notifyObservers(null, type, "last data");

  assert.equal(timesCalled, 3, "* event handler is removed");
};

exports["test emit to nsIObserverService observers"] = function(assert) {
  let ios = Cc['@mozilla.org/network/io-service;1']
            .getService(Ci.nsIIOService);

  let uri = ios.newURI("http://www.foo.com", null, null);
  let timesCalled = 0;
  let lastSubject = null;
  let lastData = null;
  let lastTopic = null;

  var topic = Date.now().toString(32)
  let nsIObserver = {
    QueryInterface: function() {
      return nsIObserver;
    },
    observe: function(subject, topic, data) {
      timesCalled = timesCalled + 1;
      lastSubject = subject;
      lastData = data;
      lastTopic = topic;
    }
  };

  nsIObserverService.addObserver(nsIObserver, topic, false);

  events.emit(topic, { subject: uri, data: "some data" });

  assert.equal(timesCalled, 1, "emit notifies observers");
  assert.equal(lastTopic, topic, "event type is notification topic");
  assert.equal(lastSubject.wrappedJSObject.object, uri,
               "event.subject is notification subject");
  assert.equal(lastData, "some data", "event.data is notification data");

  function customSubject() {}
  function customData() {}
  events.emit(topic, { subject: customSubject, data: customData });

  assert.equal(timesCalled, 2, "emit notifies observers");
  assert.equal(lastTopic, topic, "event.type is notification");
  assert.equal(lastSubject.wrappedJSObject.object, customSubject,
               "event.subject is notification subject");
  assert.equal(lastData, customData, "event.data is notification data");

  nsIObserverService.removeObserver(nsIObserver, topic, false);

  events.emit(topic, { data: "more data" });

  assert.equal(timesCalled, 2, "removed observers no longer invoked");

  nsIObserverService.addObserver(nsIObserver, "*", false);

  events.emit(topic, { data: "data again" });

  assert.equal(timesCalled, 3, "emit notifies * observers");
  assert.equal(lastTopic, topic, "event.type is notification");
  assert.equal(lastSubject, null,
               "event.subject is notification subject");
  assert.equal(lastData, "data again", "event.data is notification data");

  nsIObserverService.removeObserver(nsIObserver, "*");

  events.emit(topic, { data: "last data" });
  assert.equal(timesCalled, 3, "removed observers no longer invoked");
}

require("test").run(exports);
