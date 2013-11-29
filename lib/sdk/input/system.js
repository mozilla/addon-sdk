/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci, Cr } = require("chrome");
const { Input, start, stop, end, receive, outputs } = require("./signal");
const { id: addonID } = require("../self");

const unloadMessage = require("@loader/unload");
const { addObserver, removeObserver } = Cc['@mozilla.org/observer-service;1'].
                                          getService(Ci.nsIObserverService);



const isLegacyWrapper = x =>
    x && x.wrappedJSObject &&
    "observersModuleSubjectWrapper" in x.wrappedJSObject;

const unwrapLegacy = x => x.wrappedJSObject.object;

const InputPort = function({id, topic, initial}) {
  this.id = id || topic;
  this.topic = topic || "sdk:" + addonID + ":" + id;
  this.value = initial === void(0) ? null : initial;
  this.closed = false;
  this.started = false;
  this[outputs] = [];
};

// InputPort type implements `Input` signal interface. When port
// is started observer is registered, when port is stopped observer
// is removed. Note that port ends when add-on is unloaded.
InputPort.prototype = new Input();
InputPort.prototype[start] = input => {
  addObserver(input, input.topic, true);
};
InputPort.prototype[stop] = input => {
  removeObserver(input, input.topic);
};

InputPort.prototype.constructor = InputPort;
InputPort.prototype.QueryInterface = function(iid) {
  if (!iid.equals(Ci.nsIObserver) && !iid.equals(Ci.nsISupportsWeakReference))
    throw Cr.NS_ERROR_NO_INTERFACE;

  return this;
};
InputPort.prototype.observe = function(subject, topic, data) {
  // Unwrap message from the subject. SDK used to have it's own version of
  // wrappedJSObjects which take precedence, if subject has `wrappedJSObject`
  // use it as message. Otherwise use subject as is.
  const message = subject === null ? null :
        isLegacyWrapper(subject) ? unwrapLegacy(subject) :
        subject.wrappedJSObject ? subject.wrappedJSObject :
        subject;

  // If observer topic matches topic of the input port receive a message.
  if (topic === this.topic) {
    receive(this, message);
  }

  // If observe topic is add-on unload topic we create an end message.
  if (topic === "sdk:loader:destroy" && message === unloadMessage) {
    end(this);
  }
};

exports.InputPort = InputPort;
