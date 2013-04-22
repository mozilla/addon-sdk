/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

// This module attempts to hide trait based nature of the worker so that
// code depending on workers could be de-trait-ified without changing worker
// implementation.

const { Worker: WorkerTrait } = require("../content/worker");
const { Loader } = require("../content/loader");
const { merge } = require("../util/object");
const { emit } = require("../event/core");

const LegacyWorker = WorkerTrait.resolve({
  _setListeners: "__setListeners",
}).compose(Loader, {
  _setListeners: function() {},
  attach: function(window) this._attach(window),
  detach: function() this._workerCleanup()
});

// Weak map that stores mapping between regular worker instances and
// legacy trait based worker instances.
let traits = new WeakMap();

function traitFor(worker) traits.get(worker, null);

function WorkerHost(workerFor) {
  // Define worker properties that just proxy to a wrapped trait.
  return ["postMessage", "port", "url", "tab"].reduce(function(proto, name) {
    Object.defineProperty(proto, name, {
      enumerable: true,
      configurable: false,
      get: function() traitFor(workerFor(this))[name],
      set: function(value) traitFor(workerFor(this))[name] = value
    });
    return proto;
  }, {});
}
exports.WorkerHost = WorkerHost;

// Type representing worker instance.
function Worker(options) {
  let worker = Object.create(Worker.prototype);
  let trait = new LegacyWorker(options);
  ["pageshow", "pagehide", "detach", "message", "error"].forEach(function(key) {
    trait.on(key, function() {
      emit.apply(emit, [worker, key].concat(Array.slice(arguments)));
      // Workaround lack of ability to listen on all events by emulating
      // such ability. This will become obsolete once Bug 821065 is fixed.
      emit.apply(emit, [worker, "*", key].concat(Array.slice(arguments)));
    });
  });
  traits.set(worker, trait);
  return worker;
}
exports.Worker = Worker;

function detach(worker) {
  let trait = traitFor(worker);
  if (trait) trait.detach();
}
exports.detach = detach;

function attach(worker, window) {
  let trait = traitFor(worker);
  // Cleanup the worker before injecting the content script into a new document.
  trait.attach(window);
}
exports.attach = attach;
