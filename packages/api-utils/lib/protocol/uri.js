/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const { CoreProtocol } = require('./core');
const { Protocol: URLProtocol } = require('./url');
const { CustomURL } = require('./xpcom/uri');

const ProtocolHandler = CoreProtocol.extend(URLProtocol, {
  onResolve: function onResolve() {
    throw Error('Missing required `onResolve` property.');
  },
  newURI: function newURI(relative, charset, base) {
    return CustomURL.new(this.onResolve(relative, base && base.spec, charset));
  }
});
exports.ProtocolHandler = ProtocolHandler;
