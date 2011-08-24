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

const { Cc, Ci } = require('chrome');
const { events } = require('../events/stream');
const { filter, map, merge, head } = require('../streamer');
const { get, curry, compose } = require('../functional');

const mediator = Cc['@mozilla.org/appshell/window-mediator;1'].
                 getService(Ci.nsIWindowMediator);

// Utility function to create handlers with specific event type.
function handler(type) {
  return function onEvent(event) {
    if (false === this.delegate({ type: type, event: event }))
      mediator.removeListener(this);
  }
}

// Object that can be used to create objects that implement
// `nsIWindowMediatorListener`.
const Listener = {
  new: function (delegate) {
    return Object.create(this, { delegate: { value: delegate } });
  },
  onWindowTitleChange: handler('title'),
  onOpenWindow: handler('open'),
  onCloseWindow: handler('close'),
};

// Utility function that extracts `nsIDOMWindow` from the event objects that
// emitted by `Listener` objects.
function window({ event: { docShell: $ } })
  $.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow)

// Utility function that creates filter function for filtering out events
// with the given type.
function type(value) function(event) event.type === value

// Stream of 'open', 'close', 'title' events of all `nsIXULWindow`. Event
// objects have form of `{ type: 'open', event: window }` where window
// implements `nsIXULWindow` interface.
exports.events = function stream(next, stop) {
  mediator.addListener(Listener.new(next))
}

// Stream of all `nsIXULWindow` `'open'` events. Event objects represent
// `nsIDOMWindow` which was opened.
exports.open = map(window, filter(type('open'), exports.events));

// Stream of all `nsIXULWindow` `'close'` events. Event objects represent
// `nsIDOMWindow` which was opened.
exports.close = map(window, filter(type('close'), exports.events));

// Stream of all `nsIXULWindow` title change events. Event objects represent
// `nsIDOMWindow` who's  title was changed.
exports.title = map(window, filter(type('title'), exports.events));

// Stream of all `nsIXULWindow` DOMContentLoaded events.
//
// XULWindow `open` window events are mapped to the streams of
// DOMContentLoaded' events of the associated windows and then stream of streams
// is flattened down to single form stream.
exports.ready = map(
  // Each `DOMContentLoaded` event is mapped back to it's associated
  // `nsIDOMWindow`. To do this we compose this utility function that takes
  // `event` object as an argument and returns `event.target.defaultView`.
  compose(curry(get)('defaultView'), curry(get)('target')),

  // We map each open window to it's 'DOMContentLoaded' event stream. Since,
  // we care only about first event per window, we use `head` utility function
  // that returns subset of stream containing only first event (This way all
  // DOM event listeners also get removed immediately). Finally we flatten down
  // stream of 'DOMContentLoaded' event streams to a single form event stream.
  merge(map(compose(head, curry(events)('DOMContentLoaded')), exports.open))
);
