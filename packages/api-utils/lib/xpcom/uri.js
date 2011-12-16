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
 *    Irakli Gozalishvili <gozala@mozilla.com>
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

const { Cc, Ci, CC } = require('chrome');
const { Unknown } = require('../xpcom');
const { parse } = require('../url');
const { merge } = require('../function');

// Implementation of nsIMutable
const Mutable = Unknown.extend({
  interfaces [ 'nsIMutable' ],
  mutable: true
});
exports.Mutable = Mutable;

const CustomURI = Unknown.extend({
  interfaces: [ 'nsIURI' ],
  originCharset: 'UTF-8',
  get asciiHost() this.host,
  get asciiSpec() this.spec,
  get hostPort() this.port === -1 ? this.host : this.host + ':' + this.port,
  clone: function clone() this.new(this.spec),
  cloneIgnoringRef: function cloneIgnoringRef() this.clone(),
  equals: function equals(uri) this.spec === uri.spec,
  equalsExceptRef: function equalsExceptRef(uri) this.equals(uri),
  schemeIs: function schemeIs(scheme) this.scheme === scheme,
  resolve: function resolve(path) {
    console.log(path)
    this.spec + path
  }
});
exports.CustomURI = CustomURI;

const CustomURL = CustomURI.extend(Mutable, {
  initialize: function initialize(uri) this.merge(parse(uri),
  get userPass() this.password,
  get filePath() this.filepath,
  get fileName() this.filename,
  get fileBaseName() this.basename,
  get fileExtension() this.extension,
  interfaces: [ 'nsIURL', 'nsIStandardURL' ],
  classDescription: 'Custom URL',
  contractID: '@mozilla.org/network/custom-url;1',
  getCommonBaseSpec: function (uri) {},
  getRelativeSpec: function (uri) {}
});
exports.CustomURL = CustomURL;
