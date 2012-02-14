/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { on, once, off } = require('./core');
const { method } = require('../utils/function');
const { Base } = require('../base');

const EVENT_TYPE_PATTERN = /^on([A-Z]\S+$)/;

/**
 * `EventTarget` is an exemplar for creating an objects that can be used to
 * add / remove event listeners on them.
 */
const EventTarget = Base.extend({
  /**
   * Method initializes `this` event source. It goes through properties of a
   * given `options` and registers listeners for the ones that look like an
   * event listeners.
   */
  initialize: function initialize(options) {
    // Go through each property and registers event listeners for those
    // that have a name matching following pattern (`onEventType`).
    Object.keys(options = options || {}).forEach(function onEach(key) {
      let match = EVENT_TYPE_PATTERN.exec(key);
      let type = match && match[1].toLowerCase();
      let listener = options[key];

      if (type && typeof(listener) === 'function')
        this.on(type, listener);
    }, this);
  },
  /**
   *  Registers an event `listener` that is called every time events of
   * specified `type` are emitted.
   * @param {String} type
   *    The type of event.
   * @param {Function} listener
   *    The listener function that processes the event.
   * @example
   *      worker.on('message', function (data) {
   *        console.log('data received: ' + data)
   *      })
   */
  on: method(on),
  /**
   * Registers an event `listener` that is called once the next time an event
   * of the specified `type` is emitted.
   * @param {String} type
   *    The type of the event.
   * @param {Function} listener
   *    The listener function that processes the event.
   */
  once: method(once),
  /**
   * Removes an event `listener` for the given event `type`.
   * @param {String} type
   *    The type of event.
   * @param {Function} listener
   *    The listener function that processes the event.
   */
  removeListener: function removeListener(type, listener) {
    off(this, type, listener);
  }
});
exports.EventTarget = EventTarget;
