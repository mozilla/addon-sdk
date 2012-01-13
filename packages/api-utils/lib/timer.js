/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { CC } = require("chrome");
const { Unknown } = require("./xpcom");
const { when: unload } = require("./unload");

const Timer = CC('@mozilla.org/timer;1', 'nsITimer');

// Registry for all timers.
const timers = (function(map, id) {
  return Object.defineProperties(function registry(key, fallback) {
    return key in map ? map[key] : fallback;
  }, {
    register: { value: function(value) (map[++id] = value, id) },
    unregister: { value: function(key) delete map[key] },
    forEach: { value: function(callback) Object.keys(map).forEach(callback) }
  });
})(Object.create(null), 0);

const TimerCallback = Unknown.extend({
  interfaces: [ 'nsITimerCallback' ],
  initialize: function initialize(id, callback, rest) {
    this.id = id;
    this.callback = callback;
    this.arguments = rest;
  }
});

const TimeoutCallback = TimerCallback.extend({
  type: 0, // nsITimer.TYPE_ONE_SHOT
  notify: function notify() {
    try {
      timers.unregister(this.id);
      this.callback.apply(null, this.arguments);
    }
    catch (error) {
      console.exception(error);
    }
  }
});

const IntervalCallback = TimerCallback.extend({
  type: 1, // nsITimer.TYPE_REPEATING_SLACK
  notify: function notify() {
    try {
      this.callback.apply(null, this.arguments);
    }
    catch (error) {
      console.exception(error);
    }
  }
});

function setTimer(TimerCallback, listener, delay) {
  let timer = Timer();
  let id = timers.register(timer);
  let callback = TimerCallback.new(id, listener, Array.slice(arguments, 3));
  timer.initWithCallback(callback, delay || 0, TimerCallback.type);
  return id;
}

function unsetTimer(id) {
  let timer = timers(id);
  timers.unregister(id);
  if (timer)
    timer.cancel();
}

exports.setTimeout = setTimer.bind(null, TimeoutCallback);
exports.setInterval = setTimer.bind(null, IntervalCallback);
exports.clearTimeout = unsetTimer;
exports.clearInterval = unsetTimer;

unload(function() { timers.forEach(unsetTimer); });
