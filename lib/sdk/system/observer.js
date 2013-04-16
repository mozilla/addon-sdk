/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const unload = require("./unload").when;
const { on, off, emit, once } = require("./events");
const { defer } = require('sdk/core/promise');

let unloaded = false;

function add(topic) {
  let {promise, resolve} = defer();

  function callback() {
    if (!unloaded) resolve.apply(null, arguments);
  }

  on(topic, callback, true);

  promise.off = function() {
    // remove from the cache
    off(topic, callback, true);
  }

  return promise;
}
exports.on = add;

exports.emit = emit;

unload(function() unloaded = true);
