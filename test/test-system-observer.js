'use strict';

const events = require('sdk/system/observer');
const self = require("sdk/self");
const { Cc, Ci, Cu } = require("chrome");
const { setTimeout } = require("sdk/timers");
const { LoaderWithHookedConsole2 } = require("sdk/test/loader");
const nsIObserverService = Cc["@mozilla.org/observer-service;1"].
                           getService(Ci.nsIObserverService);

exports["test basic"] = function(assert) {
  let type = Date.now().toString(32);

  let timesCalled = 0;
  function handler(subject, data) { timesCalled++; };

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
}

exports["test error reporting"] = function(assert) {
  let { loader, messages } = LoaderWithHookedConsole2(module);

  let events = loader.require("sdk/system/observer");
  function brokenHandler(subject, data) { throw new Error("foo"); };

  let lineNumber;
  try { brokenHandler() } catch (error) { lineNumber = error.lineNumber }

  let errorType = Date.now().toString(32);

  events.on(errorType, brokenHandler);
  events.emit(errorType, { data: "yo yo" });

  assert.equal(messages.length, 1, "Got an exception");
  let text = messages[0];
  assert.ok(text.indexOf(self.name + ": An exception occurred.") >= 0,
            "error is logged");
  assert.ok(text.indexOf("Error: foo") >= 0, "error message is logged");
  assert.ok(text.indexOf(module.uri) >= 0, "module uri is logged");
  assert.ok(text.indexOf(lineNumber) >= 0, "error line is logged");

  events.off(errorType, brokenHandler);

  loader.unload();
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

  nsIObserverService.removeObserver(nsIObserver, topic);

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

exports.testUnloadAndErrorLogging = function(assert) {
  let { loader, messages } = LoaderWithHookedConsole2(module);
  var sbobsvc = loader.require("sdk/system/observer");

  var timesCalled = 0;
  var cb = function(subject, data) {
    timesCalled++;
  };
  var badCb = function(subject, data) {
    throw new Error("foo");
  };
  sbobsvc.on("blarg", cb);
  events.emit("blarg", {data: "yo yo"});
  assert.equal(timesCalled, 1);
  sbobsvc.on("narg", badCb);
  events.emit("narg", {data: "yo yo"});
  var lines = messages[0].split("\n");
  assert.equal(lines[0], "error: " + require("sdk/self").name + ": An exception occurred.");
  assert.equal(lines[0], "error: " + require("sdk/self").name + ": An exception occurred.");
  assert.equal(lines[1], "Error: foo");
  // Keep in mind to update "18" to the line of "throw new Error("foo")"
  assert.equal(lines[2], module.uri + " 196");
  assert.equal(lines[3], "Traceback (most recent call last):");

  loader.unload();
  events.emit("blarg", {data: "yo yo"});
  assert.equal(timesCalled, 1);
};

exports.testObserverService = function(assert) {
  var ios = Cc['@mozilla.org/network/io-service;1']
            .getService(Ci.nsIIOService);
  var service = Cc["@mozilla.org/observer-service;1"].
                getService(Ci.nsIObserverService);
  var uri = ios.newURI("http://www.foo.com", null, null);
  var timesCalled = 0;
  var lastSubject = null;
  var lastData = null;

  var cb = function({subject, data}) {
    timesCalled++;
    lastSubject = subject;
    lastData = data;
  };

  events.on("blarg", cb);
  service.notifyObservers(uri, "blarg", "some data");
  assert.equal(timesCalled, 1,
                   "on() should call callback");
  assert.equal(lastSubject, uri,
                   "on() should pass subject");
  assert.equal(lastData, "some data",
                   "on() should pass data");

  function customSubject() {}
  function customData() {}
  events.emit("blarg", {subject: customSubject, data: customData});
  assert.equal(timesCalled, 2,
                   "emit() should work");
  assert.equal(lastSubject, customSubject,
                   "emit() should pass+wrap subject");
  assert.equal(lastData, customData,
                   "emit() should pass data");

  events.off("blarg", cb);
  service.notifyObservers(null, "blarg", "some data");
  assert.equal(timesCalled, 2,
                   "off() should work");
};

require("test").run(exports);
