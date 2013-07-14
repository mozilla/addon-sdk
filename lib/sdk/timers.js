/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'stable'
};

const { CC, Ci } = require('chrome');
const { when: unload } = require('./system/unload');

const { TYPE_ONE_SHOT, TYPE_REPEATING_SLACK } = Ci.nsITimer;
const Timer = CC('@mozilla.org/timer;1', 'nsITimer');
const timers = Object.create(null);

let lastTimerID = 0;

// Sets typer either by timeout or by interval
// depending on a given type.
function setTimer(type, callback, delay) {
  let id = lastTimerID++;
  let timer = timers[id] = Timer();
  let args = Array.slice(arguments, 3);

  timer.initWithCallback({
    notify: function notify() {
      try {
        if (type === TYPE_ONE_SHOT)
          timers[id] = null;

        callback.apply(null, args);
      }
      catch(e) {
        console.exception(e);
      }
    }
  }, delay || 0, type);

  return id;
}

function unsetTimer(id) {
  let timer = timers[id];
  if (timer) {
    timers[id] = null;
    timer.cancel();
  }
}

exports.setTimeout = setTimer.bind(null, TYPE_ONE_SHOT);
exports.setInterval = setTimer.bind(null, TYPE_REPEATING_SLACK);
exports.clearTimeout = unsetTimer;
exports.clearInterval = unsetTimer;

unload(function() Object.keys(timers).forEach(unsetTimer));
