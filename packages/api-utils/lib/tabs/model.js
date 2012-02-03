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


const { Record } = require('../mvc/records');
const guards = require('../guards');

exports.Tab = Record.extend({
  fields: {
    id: guards.String(),
    title: guards.String(''),
    url: guards.String(''),
    favicon: guards.String(''),
    index: guards.Number(),
    active: guards.Boolean(false),
    pinned: guards.Boolean(false)
  },

  get title() this.attributes.title,
  set title(value) this.set({ title: value }),
  get url() this.attributes.url,
  set url(value) this.set({ url: value }),
  get favicon() this.attributes.favicon,
  get index() this.attributes.index,
  set index(value) this.set({ index: value }),
  get isPinned() this.attributes.pinned,
  pin: function pin() this.set({ pinned: true }),
  unpin: function unpin() this.set({ pinned: false }),
  activate: function activate() this.set({ active: true }),
  getThumbnail: function getThumbnail() {
  }
});
