/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

module.metadata = {
  'stability': 'unstable'
};

const { Cc, Ci } = require('chrome');
const { Unknown } = require('../platform/xpcom');
const { Class } = require('../core/heritage');
const { ns } = require('../core/namespace');
const { addObserver, removeObserver, notifyObservers } = 
  Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);

const Subject = Class({
  extends: Unknown,
  initialize: function initialize(object) {
    // Double-wrap the object and set a property identifying the
    // wrappedJSObject as one of our wrappers to distinguish between
    // subjects that are one of our wrappers (which we should unwrap
    // when notifying our observers) and those that are real JS XPCOM
    // components (which we should pass through unaltered).
    this.wrappedJSObject = {
      observersModuleSubjectWrapper: true,
      object: object
    };
  },
  getHelperForLanguage: function() {},
  getInterfaces: function() {}
});

function emit(topic, event) {
  let subject = 'subject' in event ? Subject(event.subject) : null;
  let data = 'data' in event ? event.data : null;
  notifyObservers(subject, topic, data);
}
exports.emit = emit;

const Observer = Class({
  extends: Unknown,
  initialize: function initialize(listener) {
    this.listener = listener;
  },
  interfaces: [ 'nsIObserver', 'nsISupportsWeakReference' ],
  observe: function(subject, topic, data) {
    // Extract the wrapped object for subjects that are one of our
    // wrappers around a JS object.  This way we support both wrapped
    // subjects created using this module and those that are real
    // XPCOM components.
    if (subject && typeof(subject) == 'object' &&
        ('wrappedJSObject' in subject) &&
        ('observersModuleSubjectWrapper' in subject.wrappedJSObject))
      subject = subject.wrappedJSObject.object;

    try {
      this.listener({
        topic: topic,
        subject: subject,
        data: data
      });
    }
    catch (error) {
      console.exception(error);
    }
  }
});

const subscribers = ns();

function on(topic, listener, strong) {
  // Unless last optional argument is `true` we use a weak reference to a
  // listener.
  let weak = !strong;
  // Take list of observers associated with given `listener` function.
  let observers = subscribers(listener);
  // If `observer` for the given `topic` is not registered yet, then
  // associate an `observer` and register it.
  if (!(topic in observers)) {
    let observer = Observer(listener);
    observers[topic] = observer;
    addObserver(observer, topic, weak);
  }
}
exports.on = on;

function once(topic, listener) {
  // Note: this code assumes order in which listeners are called, which is fine
  // as long as dispatch happens in same order as listener registration which
  // is the case now. That being said we should be aware that this may break
  // in a future if order will change.
  on(topic, listener);
  on(topic, function cleanup() {
    off(topic, listener);
    off(topic, cleanup);
  }, true);
}
exports.once = once;

function off(topic, listener) {
  // Take list of observers as with the given `listener`.
  let observers = subscribers(listener);
  // If `observer` for the given `topic` is registered, then
  // remove it & unregister.
  if (topic in observers) {
    let observer = observers[topic];
    delete observers[topic];
    removeObserver(observer, topic);
  }
}
exports.off = off;
