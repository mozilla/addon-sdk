/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const observers = require("sdk/deprecated/observer-service");
const { Cc, Ci } = require("chrome");
const { Loader } = require("sdk/test/loader");
const { PlainTextConsole } = require("sdk/console/plain-text");
const {uuid} = require('sdk/util/uuid');

exports.testUnloadAndErrorLogging = function(test) {
  var prints = [];
  var loader = Loader(module, {
    console: new PlainTextConsole(function(_) {
      prints.push(_);
    })
  });
  var sbobsvc = loader.require("sdk/deprecated/observer-service");

  var timesCalled = 0;
  var cb = function(subject, data) {
    timesCalled++;
  };
  var badCb = function(subject, data) {
    throw new Error("foo");
  };
  sbobsvc.add("blarg", cb);
  observers.notify("blarg", "yo yo");
  test.assertEqual(timesCalled, 1);
  sbobsvc.add("narg", badCb);
  observers.notify("narg", "yo yo");
  var lines = prints[0].split("\n");
  test.assertEqual(lines[0], "error: " + require("sdk/self").name + ": An exception occurred.");
  test.assertEqual(lines[1], "Traceback (most recent call last):");
  test.assertEqual(lines.slice(-2)[0], "Error: foo");

  loader.unload();
  observers.notify("blarg", "yo yo");
  test.assertEqual(timesCalled, 1);
};

exports.testObserverService = function(test) {
  var ios = Cc['@mozilla.org/network/io-service;1']
            .getService(Ci.nsIIOService);
  var service = Cc["@mozilla.org/observer-service;1"].
                getService(Ci.nsIObserverService);
  var uri = ios.newURI("http://www.foo.com", null, null);
  var timesCalled = 0;
  var lastSubject = null;
  var lastData = null;

  var cb = function(subject, data) {
    timesCalled++;
    lastSubject = subject;
    lastData = data;
  };

  observers.add("blarg", cb);
  service.notifyObservers(uri, "blarg", "some data");
  test.assertEqual(timesCalled, 1,
                   "observer-service.add() should call callback");
  test.assertEqual(lastSubject, uri,
                   "observer-service.add() should pass subject");
  test.assertEqual(lastData, "some data",
                   "observer-service.add() should pass data");

  function customSubject() {}
  function customData() {}
  observers.notify("blarg", customSubject, customData);
  test.assertEqual(timesCalled, 2,
                   "observer-service.notify() should work");
  test.assertEqual(lastSubject, customSubject,
                   "observer-service.notify() should pass+wrap subject");
  test.assertEqual(lastData, customData,
                   "observer-service.notify() should pass data");

  observers.remove("blarg", cb);
  service.notifyObservers(null, "blarg", "some data");
  test.assertEqual(timesCalled, 2,
                   "observer-service.remove() should work");
};

exports.testObserverWildcard = function(test) {
  let uu = function() uuid().number.slice(1,-1);

  var counter = {};
  let uuids = [0,1,2,3,4,5].map(uu);

  var cb = function(subject, data, topic) {
    if (counter[topic] === undefined) {counter[topic] = 0};
    counter[topic] ++;
  };

  observers.add("*", cb);

  uuids.forEach(function(id){
    observers.notify(id, {},{});
  })

  uuids.forEach(function(id){
    test.assertEqual(counter[id], 1, "wildcard counter detects correct topic, not '*' ")
  });

  observers.remove("*", cb);

};
