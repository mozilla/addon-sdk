/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const { Ci, CC } = require('chrome');
const { CoreProtocol } = require('./core');
const { pick } = require('../utils/object');

const StandardURL = CC('@mozilla.org/network/standard-url;1',
                       'nsIStandardURL', 'init');

const Flags = pick([ 'URI_STD', 'URI_NORELATIVE', 'URI_NOAUTH',
  'URI_INHERITS_SECURITY_CONTEXT', 'URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT',
  'URI_LOADABLE_BY_ANYONE', 'URI_DANGEROUS_TO_LOAD', 'URI_IS_UI_RESOURCE',
  'URI_IS_LOCAL_FILE', 'URI_LOADABLE_BY_SUBSUMERS', 'URI_NON_PERSISTABLE',
  'URI_IS_LOCAL_RESOURCE', 'URI_DOES_NOT_RETURN_DATA', 'ALLOWS_PROXY',
  'URI_OPENING_EXECUTES_SCRIPT', 'ALLOWS_PROXY_HTTP' ], Ci.nsIProtocolHandler);

const URITypes = pick([ 'URLTYPE_STANDARD', 'URLTYPE_AUTHORITY',
  'URLTYPE_NO_AUTHORITY' ], Ci.nsIStandardURL);

const Protocol = CoreProtocol.extend(Flags, URITypes, {
  get scheme() { throw Error('Missing required `scheme` property.'); },
  interfaces: [ 'nsIProtocolHandler' ],
  get description() {
    return 'Protocol handler for "' + this.scheme + ':*"';
  },
  get contract() {
    return '@mozilla.org/network/protocol;1?name=' + this.scheme;
  },
  // Feel free to override.
  allowPort: function(port, scheme) { return false },
  defaultPort: -1,
  // For more information on what these flags mean,
  // https://developer.mozilla.org/en/nsIProtocolHandler#Constants
  protocolFlags: Flags.URI_NORELATIVE | Flags.URI_DANGEROUS_TO_LOAD,

  /**
   * Property describe how to normalize an URL.
   * @see https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIStandardURL#Constants
   */
  type: URITypes.URLTYPE_STANDARD,
  newURI: function newURI(relative, charset, base) {
    var url = StandardURL(this.type, this.defaultPort, relative, charset, base);
    url.QueryInterface(Ci.nsIURL);
    return url;
  }
});
exports.Protocol = Protocol;
