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

// TODO: Tweak linker and loader to use following instead:
// require('env!api-utils/chrome/notifications')
const channel = require('api-utils/env!')('api-utils/chrome/notifications');
const { distributed } = require('../stream-utils');
const { compose } = require("../functional");
const guards = require("../guards");

const listen = distributed(channel.input);
const False = Boolean.bind(null, false);

const notification = guards.Schema({
  data: guards.String(""),
  iconURL: guards.String(""),
  text: guards.String(""),
  title: guards.String(""),
  onClick: guards.AnyOf([ guards.Function(), guards.Undefined() ])
});

exports.notify = function notify(options) {
  let { data, iconURL, text, title, onClick } = notification(options);
  let id = onClick ? listen(compose(False, onClick.bind(null, data))) : null;
  channel.output({
    id: id,
    title: title,
    text: text,
    iconURL: iconURL,
    data: data
  });
};
