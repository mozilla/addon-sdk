/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci, Cr } = require("chrome");
const { spawn, STOP, END } = require("signalize/core");
const { hub } = require("signalize/hub");
const { addObserver, removeObserver } = Cc['@mozilla.org/observer-service;1'].
                                        getService(Ci.nsIObserverService);

var index = 0;

// Simple class that can be used to instantiate event channel that
// implements `nsIObserver` interface. It's will is used by `observe`
// function as observer + event target. It basically proxies observer
// notifications as to it's registered listeners.
function ObserverSignal(topic) { this.topic = topic; }
ObserverSignal.prototype.QueryInterface = function(iid) {
  if (!iid.equals(Ci.nsIObserver) &&
      !iid.equals(Ci.nsISupportsWeakReference) &&
      !iid.equals(Ci.nsISupports))
    throw Cr.NS_ERROR_NO_INTERFACE;
  return this;
};
ObserverSignal.prototype.observe = function(subject, topic, data) {
  let event = { type: topic, target: subject, data: data, index: ++index };
  console.log("%%%%", topic)
  let result = this.next(event)
  if (result === STOP) {
    removeObserver(this, this.topic);
    this.next(END);
  }
  return result;
};

spawn.define(ObserverSignal, function(observer, next) {
  // Note: `nsIObserverService` will hold a weak reference to a
  // observerSignal (since third argument is `true`). There for if it
  // will be GC-ed with all it's event listeners once no other
  // references to it will be held.
  observer.next = next;
  addObserver(observer, observer.topic, false);
});

function observe(topic) hub(new ObserverSignal(topic));

exports.observe = observe;
