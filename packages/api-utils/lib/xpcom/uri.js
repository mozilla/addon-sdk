/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { Cc, Ci, CC } = require('chrome');
const { newURI } = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const { Unknown } = require('../xpcom');
const { parse } = require('../url');

// Implementation of nsIMutable
const Mutable = Unknown.extend({
  interfaces: [ 'nsIMutable' ],
  mutable: true
});
exports.Mutable = Mutable;

// Implements base exemplar for a `nsIURI` interface.
const CustomURI = Unknown.extend({
  initialize: function initialize(uri) this.merge(parse(uri)),
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
    return newURI(path, null, newURI(this.spec)).spec;
  }
});
exports.CustomURI = CustomURI;

const CustomURL = CustomURI.extend(Mutable, {
  initialize: function initialize(uri) this.merge(parse(uri)),
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
