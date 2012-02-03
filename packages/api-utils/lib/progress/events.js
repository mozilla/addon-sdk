/* vim:set ts=2 sw=2 sts=2 expandtab */
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
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

const { Cc, Ci } = require("chrome");
const { Component } = require("../component");

function ignore() {};
const WebProgressListener = Component.extend({
  interfaces: Component.interfaces.concat([ Ci.nsIWebProgressListener ]),
  // This is not necessary, but it seems that component is being queried with
  // a non nsIWebProgressListener interface but with something very strange:
  // "{00000000-0000-0000-c000-000000000046}" causing errors. Workaround by
  // returning `this` every time.
  QueryInterface: function() this,

  initialize: function initialize(target, next) {
    this.delegate = next;
    this.register(target);
  },
  register: function register(progress) {
    progress.addProgressListener(this, this.flags);
  },
  unregister: function unregister(progress) {
    progress.removeProgressListener(this);
  },
  emit: function emit(event) {
    if (false === this.delegate(event))
      this.unregister(event.target)
  },

  onLocationChange: ignore,
  onProgressChange: ignore,
  onSecurityChange: ignore,
  onStateChange: ignore,
  onStatusChange: ignore
});

const listeners = {
  location: WebProgressListener.extend({
    flags: Ci.nsIWebProgress.NOTIFY_LOCATION,
    onLocationChange: function (target, request, uri) {
      this.emit({ target: target, request: request, location: uri })
    }
  }),
  progress: WebProgressListener.extend({
    flags: Ci.nsIWebProgress.NOTIFY_PROGRESS,
    onProgressChange: function (target, request, s, sMax, t, tMax) {
      this.emit({
        target: target,
        request: request,
        self: { progress: s, max: sMax },
        total: { progress: t, max: tMax }
      });
    }
  })
}

exports.events = function events(target, type) {
  return function stream(next, stop) {
    if (type in listeners)
      listeners[type].new(target, next)
  }
};
