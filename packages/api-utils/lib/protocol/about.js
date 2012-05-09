/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const { CoreProtocol } = require('./core');
const { ALLOW_SCRIPT, URI_SAFE_FOR_UNTRUSTED_CONTENT,
        HIDE_FROM_ABOUTABOUT } = require('chrome').Ci.nsIAboutModule;

const Protocol = CoreProtocol.extend({
  get what() { throw Error('Missing required property `what`'); },
  interfaces: [ 'nsIAboutModule' ],
  // A flag that indicates whether script should be enabled for the given
  // about: URI even if it's disabled in general.
  allowScript: true,
  // A flag that indicates whether a URI is safe for untrusted content. If it
  // is, web pages and so forth will be allowed to link to this about: URI.
  // Otherwise, only chrome will be able to link to it.
  allowUnsafeLinks: false,
  // A flag that indicates whether this about: URI doesn't want to be listed
  // in about:about, especially if it's not useful without a query string.
  allowListing: true,
  get description() {
    return 'Protocol handler for "about:' + this.what + '"';
  },
  get contract() {
    return '@mozilla.org/network/protocol/about;1?what=' + this.what;
  },
  getURIFlags: function(uri) {
    return (
      this.allowScript ? ALLOW_SCRIPT : 0 |
      this.allowUnsafeLinks ? URI_SAFE_FOR_UNTRUSTED_CONTENT : 0 |
      this.allowListing ? HIDE_FROM_ABOUTABOUT : 0);
  }
});
exports.Protocol = Protocol;
