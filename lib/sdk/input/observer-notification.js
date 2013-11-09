/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci, Cr } = require("chrome");
const { Input, start, stop, receive, outputs } = require("./signal");
const { addObserver, removeObserver,
        notifyObservers } = Cc['@mozilla.org/observer-service;1'].
                             getService(Ci.nsIObserverService);


const raise = error => { throw error }

function ObserverNotifications(topic, initial) {
  this.topic = topic;
  this.value = initial;
  this[outputs] = [];
}

ObserverNotifications.prototype = new Input();
ObserverNotifications.prototype.constructor = ObserverNotifications;

ObserverNotifications.prototype.QueryInterface = function(iid) {
  return iid.equals(Ci.nsIObserver) ? this :
         iid.equals(Ci.nsISupportsWeakReference) ? this :
         raise(Cr.NS_ERROR_NO_INTERFACE);
};
ObserverNotifications.prototype.observe = function(subject, topic, data) {
  // Extract the wrapped object for subjects that are one of our
  // wrappers around a JS object.  This way we support both wrapped
  // subjects created using this module and those that are real
  // XPCOM components.
  if (subject && typeof(subject) == "object" &&
      ("wrappedJSObject" in subject) &&
      ("observersModuleSubjectWrapper" in subject.wrappedJSObject))
    subject = subject.wrappedJSObject.object;

  receive(this, subject);
};

ObserverNotifications.prototype[start] = input => {
  addObserver(input, input.topic, true);
}
ObserverNotifications.prototype[stop] = input => {
  removeObserver(input, input.topic);
}
exports.ObserverNotifications = ObserverNotifications;

function NotificationChannel(topic) {
  this.topic = topic;
}
NotificationChannel.prototype = new Input();
NotificationChannel.constructor = NotificationChannel;
let raiseError = () => {
  throw new TypeError("NotificationChannel is only for sending messages");
}
NotificationChannel.prototype[start] = raiseError
NotificationChannel.prototype[stop] = raiseError
NotificationChannel.prototype[receive] = ({topic}, message) => {
  // If null just notfy observers.
  message === null ? notifyObservers(null, topic, null) :
  // If object implements XPCOM interface don't double wrap it.
  message && message.QueryInterface ? notifyObservers(message, topic, null) :
  // Otherwise double wrap so receiver
  notifyObservers({
    wrappedJSObject: {
      observersModuleSubjectWrapper: true,
      object: message
    }
  }, topic, null);
}
exports.NotificationChannel = NotificationChannel;
