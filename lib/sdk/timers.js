/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "stable"
};

const { Cc, Ci } = require("chrome");
const { when: unload } = require("./system/unload");

const threadManager = Cc["@mozilla.org/thread-manager;1"].
                      getService(Ci.nsIThreadManager);

let lastID = 0;

let immediates = new Map();

let dispatcher = _ => {
  // Allow scheduling of a new dispatch loop.
  dispatcher.scheduled = false;
  // Take a snapshot of timer `id`'s that have being present before
  // starting a dispatch loop, in order to ignore timers registered
  // in side effect to dispatch while also skipping immediates that
  // were removed in side effect.
  let ids = [id for ([id] of immediates)];
  for (let id of ids) {
    let immediate = immediates.get(id);
    if (immediate) {
      immediates.delete(id);
      try { immediate(); }
      catch (error) { console.exception(error); }
    }
  }
}

function setImmediate(callback, ...params) {
  let id = ++lastID;
  // register new immediate timer with curried params.
  immediates.set(id, _ => callback.apply(callback, params));
  // if dispatch loop is not scheduled schedule one. Own scheduler
  if (!dispatcher.scheduled) {
    dispatcher.scheduled = true;
    threadManager.currentThread.dispatch(dispatcher,
                                         Ci.nsIThread.DISPATCH_NORMAL);
  }
  return id;
}

function clearImmediate(id) {
  immediates.delete(id);
}

exports.setImmediate = setImmediate.bind(null);
exports.clearImmediate = clearImmediate.bind(null);

exports.setTimeout = setTimeout;
exports.setInterval = setInterval;
exports.clearTimeout = clearTimeout;
exports.clearInterval = clearInterval;

// all timers are cleared out on unload.
unload(function() {
  immediates.clear();
});
