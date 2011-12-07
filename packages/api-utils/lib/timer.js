/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Drew Willcoxon <adw@mozilla.com>
 *   Irakli Gozalishvili <gozala@mozilla.com>
 *   Erik Vold <erikvvold@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
