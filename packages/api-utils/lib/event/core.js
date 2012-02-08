/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const UNCAUGHT_ERROR = 'An error event was emitted for which there was no listener.';
const BAD_LISTENER = 'The event listener must be a function.';

const { ns } = require('../namespace');

const event = ns();

// Utility function to access given event `target` object's event listeners for
// the specific event `type`. If listeners for this type does not exists they
// will be created.
const observers = function observers(target, type) {
  let listeners = event(target);
  return type in listeners ? listeners[type] : listeners[type] = [];
};

/**
 * Registers an event `listener` that is called every time events of
 * specified `type` is emitted on the given event `target`.
 * @param {Object} target
 *    Event target object.
 * @param {String} type
 *    The type of event.
 * @param {Function} listener
 *    The listener function that processes the event.
 */
function on(target, type, listener) {
  let listeners = observers(target, type);
  if (typeof(listener) !== 'function')
    throw new Error(BAD_LISTENER);

  if (!~listeners.indexOf(listener))
    listeners.push(listener);
}
exports.on = on;

/**
 * Registers an event `listener` that is called only the next time an event
 * of the specified `type` is emitted on the given event `target`.
 * @param {Object} target
 *    Event target object.
 * @param {String} type
 *    The type of the event.
 * @param {Function} listener
 *    The listener function that processes the event.
 */
function once(target, type, listener) {
  on(target, type, function observer() {
    off(target, type, observer);
    listener.apply(target, arguments);
  });
}
exports.once = once;

/**
 * Execute each of the listeners in order with the supplied arguments.
 * All the exceptions that are thrown by listeners during the emit
 * are caught and can be handled by listeners of 'error' event. Thrown
 * exceptions are passed as an argument to an 'error' event listener.
 * If no 'error' listener is registered exception will be logged into an
 * error console.
 * @param {Object} target
 *    Event target object.
 * @param {String} type
 *    The type of event.
 * @params {Object|Number|String|Boolean}
 *    Arguments that will be passed to listeners.
 */
function emit(target, type, message) {
  let rest = Array.slice(arguments, 2);
  // slice listeners so that listeners registered in this emit won't be called.
  observers(target, type).slice().forEach(function onEach(listener) {
    try {
      listener.apply(target, rest);
    } catch (error) {
      // If exception is not thrown by a error listener and error listener is
      // registered emit `error` event. Otherwise dump exception to the console.
      if (type !== 'error' && observers(target, 'error').length)
        emit(target, 'error', error);
      else
        console.exception(error);
    }
  });
}
exports.emit = emit;

/**
 * Removes an event `listener` for the given event `type` on the given event
 * `target`. If no `listener` is passed removes all listeners of the given
 * `type`. If `type` is not passed removes all the listeners of the given
 * event `target`.
 * @param {Object} target
 *    The event target object.
 * @param {String} type
 *    The type of event.
 * @param {Function} listener
 *    The listener function that processes the event.
 */
function off(target, type, listener) {
  let length = arguments.length;
  if (length === 3) {
    let listeners = observers(target, type);
    let index = listeners.indexOf(listener);
    if (~index)
      listeners.splice(index, 1);
  }
  else if (length === 2) {
    observers(target, type).splice(0);
  }
  if (length === 1) {
    let listeners = event(target);
    Object.keys(listeners).forEach(function(type) delete listeners[type]);
  }
}
exports.off = off;
