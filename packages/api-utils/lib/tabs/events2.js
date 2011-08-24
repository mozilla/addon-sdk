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
const { ready } = require('../windows/events');
const { browsers } = require('../windows/utils');
const { events: progress } = require('../progress/events');
const { map, merge, append } = require('../streamer');
const { events } = require('../events/stream');
const { curry, identity } = require('../functional');

// Composing stream of all open windows + windows that will be opened (Actually
// when open windows become ready).
const windows = append(browsers, ready);

// We map stream of `opened` windows to a stream of streams of tab events
// and flatten it down to a single tab events stream for all windows using
// merge function.
exports.open = merge(map(curry(events)('TabOpen'), windows));
exports.close = merge(map(curry(events)('TabClose'), windows));
exports.select = merge(map(curry(events)('TabSelect'), windows));
exports.pin = merge(map(curry(events)('TabPinned'), windows));
exports.unpin = merge(map(curry(events)('TabUnpinned'), windows));
exports.move = merge(map(curry(events)('TabMove'), windows));

// For details see:
// http://mxr.mozilla.org/mozilla-central/source/mobile/chrome/content/bindings/browser.js#403

exports.title = merge(map(function({ originalTarget: tab }) {
  return map(curry(identity, 2)(tab),
             events('DOMTitleChanged', tab.linkedBrowser))
}, exports.open));

exports.ready = merge(map(function({ originalTarget: tab }) {
  return map(curry(identity, 2)(tab),
             events('DOMContentLoaded', tab.linkedBrowser))
}, exports.open));

exports.location = merge(map(function({ originalTarget: tab }) {
  return map(curry(identity, 2)(tab),
             progress(tab.linkedBrowser.docShell.
                      QueryInterface(Ci.nsIInterfaceRequestor).
                      getInterface(Ci.nsIWebProgress), 'location'));
}, exports.open));
