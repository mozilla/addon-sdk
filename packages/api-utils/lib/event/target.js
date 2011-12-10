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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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
