/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const unload = require("./unload").when;
const { on, off, emit, once } = require("./events");

// use cache to hold a ref to callbacks so that they are not gc'd
const cache = new Set();

// use count to keep track of the number of times that a callback is used
// this is used to prevent us from removing the callback from the cache
// too early
const count = new WeakMap();

const wrapperCache = new WeakMap();

let unloaded = false;

function CallbackWrapper(callback) {
  if (!wrapperCache.has(callback)) {
    wrapperCache.set(callback, function() {
      if (unloaded)
        return;

      callback.apply(null, arguments)
    });
  }

  return wrapperCache.get(callback);
}

function add(topic, callback) {
  cache.add(callback);
  count.set(callback, count.get(callback, 0) + 1);

  on(topic, CallbackWrapper(callback), false);
};
exports.on = exports.addEventListener = add;

function remove(topic, callback) {
  off(topic, CallbackWrapper(callback), false);

  count.set(callback, count.get(callback, 0) - 1);
  if (count.get(callback, 0) <= 0) {
    count.delete(callback);
    wrapperCache.delete(callback);
    cache.delete(callback); // allow gc
  }
};
exports.off = exports.removeEventListener = remove;

exports.emit = emit;

unload(function() {
  cache.clear();
  count.clear();
  wrapperCache.clear();

  unloaded = true;
});
