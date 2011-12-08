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
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
 *   Drew Willcoxon <adw@mozilla.com>
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

const UNCAUGHT_ERROR = 'An error event was emitted for which there was no listener.';
const BAD_LISTENER = 'The event listener must be a function.';

let { Namespace } = require('../namespace');

const event = Namespace();

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

  if (!~listeners.indexOf(observers))
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
    removeListener(target, type, observer);
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
