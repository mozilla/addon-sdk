/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { Unknown } = require("./xpcom");
const { when: unload } = require("./unload");
const memory = require("./memory");


/**
 * A service for adding, removing and notifying observers of notifications.
 * Wraps the nsIObserverService interface.
 *
 * @version 0.2
 */

var service = Cc["@mozilla.org/observer-service;1"].
              getService(Ci.nsIObserverService);

/**
 * A cache of observers that have been added.
 *
 * We use this to remove observers when a caller calls |Observers.remove|.
 */
var cache = [];

/**
 * Topics specifically available to Jetpack-generated extensions.
 *
 * Using these predefined consts instead of the platform strings is good:
 *   - allows us to scope topics specifically for Jetpacks
 *   - addons aren't dependent on strings nor behavior of core platform topics
 *   - the core platform topics are not clearly named
 *
 */
exports.topics = {
  /**
   * A topic indicating that the application is in a state usable
   * by add-ons.
   */
  get APPLICATION_READY() packaging.jetpackID + "_APPLICATION_READY"
};

/**
 * Register the given callback as an observer of the given topic.
 *
 * @param   topic       {String}
 *          the topic to observe
 *
 * @param   callback    {Object}
 *          the callback; an Object that implements nsIObserver or a Function
 *          that gets called when the notification occurs
 *
 * @param   target  {Object}  [optional]
 *          the object to use as |this| when calling a Function callback
 *
 * @returns the observer
 */
var add = exports.add = function add(topic, callback, target) {
  var observer = Observer.new(topic, callback, target);
  service.addObserver(observer, topic, true);
  cache.push(observer);

  return observer;
};

/**
 * Unregister the given callback as an observer of the given topic.
 *
 * @param   topic       {String}
 *          the topic being observed
 *
 * @param   callback    {Object}
 *          the callback doing the observing
 *
 * @param   target  {Object}  [optional]
 *          the object being used as |this| when calling a Function callback
 */
var remove = exports.remove = function remove(topic, callback, target) {
  // This seems fairly inefficient, but I'm not sure how much better
  // we can make it.  We could index by topic, but we can't index by callback
  // or target, as far as I know, since the keys to JavaScript hashes
  // (a.k.a. objects) can apparently only be primitive values.
  let observers = cache.filter(function(v) {
    return (v.topic == topic &&
            v.callback == callback &&
            v.target == target);
  });

  if (observers.length) {
    service.removeObserver(observers[0], topic);
    cache.splice(cache.indexOf(observers[0]), 1);
  }
};

/**
 * Notify observers about something.
 *
 * @param topic   {String}
 *        the topic to notify observers about
 *
 * @param subject {Object}  [optional]
 *        some information about the topic; can be any JS object or primitive
 *
 * @param data    {String}  [optional] [deprecated]
 *        some more information about the topic; deprecated as the subject
 *        is sufficient to pass all needed information to the JS observers
 *        that this module targets; if you have multiple values to pass to
 *        the observer, wrap them in an object and pass them via the subject
 *        parameter (i.e.: { foo: 1, bar: "some string", baz: myObject })
 */
var notify = exports.notify = function notify(topic, subject, data) {
  subject = (typeof subject == "undefined") ? null : Subject.new(subject);
  data = (typeof    data == "undefined") ? null : data;
  service.notifyObservers(subject, topic, data);
};

const Observer = Unknown.extend({
  initialize: function initialize(topic, callback, target) {
    memory.track(this);
    this.topic = topic;
    this.callback = callback;
    this.target = target;
  },
  interfaces: [ 'nsIObserver', 'nsISupportsWeakReference' ],
  observe: function(subject, topic, data) {
    // Extract the wrapped object for subjects that are one of our
    // wrappers around a JS object.  This way we support both wrapped
    // subjects created using this module and those that are real
    // XPCOM components.
    if (subject && typeof subject == "object" &&
        ("wrappedJSObject" in subject) &&
        ("observersModuleSubjectWrapper" in subject.wrappedJSObject))
      subject = subject.wrappedJSObject.object;

    try {
      if (typeof this.callback == "function") {
        if (this.target)
          this.callback.call(this.target, subject, data);
        else
          this.callback(subject, data);
      } else // typeof this.callback == "object" (nsIObserver)
        this.callback.observe(subject, topic, data);
    } catch (e) {
      console.exception(e);
    }
  }
});

const Subject = Unknown.extend({
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

unload(function() {
  // Make a copy of cache first, since cache will be changing as we
  // iterate through it.
  cache.slice().forEach(function({ topic, callback, target }) {
    remove(topic, callback, target);
  });
})
