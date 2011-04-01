/* vim:set ts=2 sw=2 sts=2 et: */
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

const { Trait } = require("light-traits");
const { removeListener, on } = require("dom/events");

/**
 * Trait may be used for building objects / composing traits that wish to handle
 * multiple dom events from multiple event targets in one place. Event targets
 * can be added / removed by calling `observe / ignore` methods. Composer should
 * provide array of event types it wishes to handle as property
 * `supportedEventsTypes` and function for handling all those events as
 * `handleEvent` property.
 */
exports.DOMEventAssembler = Trait({
  /**
   * Function that is supposed to handle all the supported events (that are
   * present in the `supportedEventsTypes`) from all the observed
   * `eventTargets`.
   * @param {Event} event
   *    Event being dispatched.
   */
  handleEvent: Trait.required,
  /**
   * Array of supported event names.
   * @type {String[]}
   */
  supportedEventsTypes: Trait.required,
  /**
   * Adds `eventTarget` to the list of observed `eventTarget`s. Listeners for
   * supported events will be registered on the given `eventTarget`.
   * @param {EventTarget} eventTarget
   */
  observe: function observe(eventTarget) {
    this.supportedEventsTypes.forEach(function(eventType) {
      on(eventTarget, eventType, this);
    }, this);
  },
  /**
   * Removes `eventTarget` from the list of observed `eventTarget`s. Listeners
   * for all supported events will be unregistered from the given `eventTarget`.
   * @param {EventTarget} eventTarget
   */
  ignore: function ignore(eventTarget) {
    this.supportedEventsTypes.forEach(function(eventType) {
      removeListener(eventTarget, eventType, this);
    }, this);
  }
});
