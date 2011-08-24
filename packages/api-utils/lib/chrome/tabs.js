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

"use strict";

const extract = require('../tabs/extractors');
const { map, merge, list } = require('../streamer');
const events = require('../tabs/events2');

function event(type) function(value) ({ type: type, value: value })

exports.open = map(event('create'), map(function onOpen(tab) {
  return {
    id: extract.id(tab),
    index: extract.index(tab),
    url: extract.url(tab),
    title: extract.title(tab),
    favicon: extract.favicon(tab),
    pinned: extract.pinned(tab),
    active: extract.active(tab)
  };
}, map(extract.tab, events.open)));

exports.close = map(event('delete'), map(function onClose(tab) {
  return { id: extract.id(tab) }
}, map(extract.tab, events.close)));

exports.select = map(event('update'), map(function onSelect(tab) {
  return { id: extract.id(tab), active: extract.active(tab) };
}, map(extract.tab, events.select)));

exports.pin = map(event('update'), map(function onPin(tab) {
  return { id: extract.id(tab), pinned: extract.pinned(tab) };
}, map(extract.tab, events.pin)));

exports.unpin = map(event('update'), map(function onUnpin(tab) {
  return { id: extract.id(tab), pinned: extract.pinned(tab) };
}, map(extract.tab, events.unpin)));

exports.move = map(event('update'), map(function onMove(tab) {
  return { id: extract.id(tab), index: extract.index(tab) };
}, map(extract.tab, events.move)));

exports.title = map(event('update'), map(function onTitleChange(tab) {
  return { id: extract.id(tab), title: extract.title(tab) };
}, events.title));

exports.location = map(event('update'), map(function onLocationChange(tab) {
  return {
    id: extract.id(tab),
    title: extract.title(tab),
    favicon: extract.favicon(tab),
    url: extract.url(tab),
  }
}, events.ready));

exports.initialize = function({ input, output }) {
  // Forwarding all events tab related events to the add-on process.
  merge(list(exports.open, exports.close, exports.select, exports.pin,
         exports.unpin, exports.move, exports.title, exports.location))(output);
};
