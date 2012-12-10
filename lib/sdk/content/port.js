/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require("../core/heritage");
const { Disposable } = require("../core/disposable");
const { ns } = require("../core/namespace");
const { EventTarget } = require("../event/target");
const { emit, off } = require("../event/core");

const ERR_DESTROYED =
  "Couldn't find the worker to receive this message. " +
  "The script may not be initialized yet, or may already have been unloaded.";

const ERR_PAUSED = "The page is currently hidden and can no longer be used " +
                   "until it is visible again.";

let port = ns();

var Port = Class({
  implements: [Disposable],
  extends: EventTarget,
  setup: function(target) {
    let internal = port(this);
    internal.target = target;
    internal.active = true;
    internal.queue = [];
  },
  emit: function emit() {
    let { target, queue } = port(this);

    if (isDisposed(this)) throw new Error(ERR_DESTROYED);

    // TODO: This comes from worker so we don't change anything, still
    // it feels that queueing up messages would be a better option then
    // throwing.
    if (isPaused(this)) throw new Error(ERR_PAUSED);

    // If port is not connect yet then queue messages.
    if (!isConnected(this)) queue.push(arguments);

    else target.emit.apply(target, ["event"].concat(Array.slice(arguments)));
  },
  dispose: function() {
    let internal = port(this);
    internal.target = null;
    internal.queue = null;
    off(this);
  }
});
exports.Port = Port;


function isDisposed(instance) {
  return port(instance).queue === null;
}
exports.isDisposed = isDisposed;

function isPaused(instance) {
  return !port(instance).active;
}
exports.isPaused = isPaused;

function pause(instance) {
  port(instance).active = false;
}
exports.pause = pause;

function resume(instance) {
  port(instance).active = true;
}
exports.resume = resume

function flush(instance) {
  port(instance).queue.splice().forEach(function(event) {
    instance.emit.apply(instance, event);
  });
}
exports.flush = flush;

function isConnected(instance) {
  return !!port(instance).target
}
exports.isConnected = isConnected;

function connect(source, target) {
  if (isConnected(source)) throw Error("Port is already connected")
  port(source).target = target;
}
exports.connect = connect;

function disconnect(source) {
  port(source).target = null;
}
exports.disconnect = disconnect

exports.ns = port;
