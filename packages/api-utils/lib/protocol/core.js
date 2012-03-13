/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const { Cc, Ci, CC } = require('chrome');
const { Base } = require('../base');
const { Unknown } = require('../xpcom');
const { ns } = require('../namespace');

const Pipe = CC('@mozilla.org/pipe;1', 'nsIPipe', 'init');
const Channel = CC('@mozilla.org/network/input-stream-channel;1',
                   'nsIInputStreamChannel');
const chromePrincipal = Cc['@mozilla.org/systemprincipal;1'].
                        createInstance(Ci.nsIPrincipal);
const { getCodebasePrincipal: Principal } =
  Cc['@mozilla.org/scriptsecuritymanager;1'].
  getService(Ci.nsIScriptSecurityManager);
const { newURI: URI, newChannel: URIChannel } =
  Cc['@mozilla.org/network/io-service;1'].
  getService(Ci.nsIIOService);

const response = ns({ stream: null });

const Response = Base.extend({
  initialize: function initialize(uri, stream) {
    // set internal stream property.
    response(this).stream = stream;
    this.merge({
      uri: uri,
      originalURI: uri,
      principalURI: uri,
      contentLength: -1,
      contentType: '',
      contentCharset: null
    });
  },
  write: function write(content) {
    response(this).stream.write(content, content.length);
  },
  end: function end(content) {
    if (content) this.write(content)
    response(this).stream.close();
  }
});

const CoreProtocol = Unknown.extend({
  onRequest: function onRequest() {
    throw Error('Missing required property `onRequest`');
  },
  newChannel: function newChannel(uri) {
    let channel, pipe, response, request;

    // We create `nsIPipe` which where response's output will be forwarded to.
    pipe = Pipe(true, true, 0, 0, null);
    request = { uri: uri.spec };
    response = Response.new(request.uri, pipe.outputStream);

    this.onRequest(request, response);

    // If response's `uri` property was modified then interpret that as a
    // redirect. In such case create a channel from a redirect `uri` and return
    // it.
    if (response.uri !== request.uri) {
      // Close a response as it's a redirect and writing to redirected socket
      // is just wrong.
      response.end();
      channel = URIChannel(response.uri, null, null);
      // Set `originalURI` pointing to a pre-redirect `uri` to make this
      // information available.
      channel.originalURI = uri;
    }
    // Otherwise create a channel from the input stream of the pipe, to which
    // user can write asynchronously.
    else {
      // Optionally `channelURI` may be set in order to override both output
      // and a URI.
      uri = response.channelURI ? URI(response.channelURI, null, null) : uri;
      channel = Channel();
      channel.setURI(uri);
      channel.contentStream = pipe.inputStream;
      channel.QueryInterface(Ci.nsIChannel);

      // Copy content length, type and charset from the response.
      channel.contentLength = response.contentLength;
      channel.contentType = response.contentType;
      channel.contentCharset = response.contentCharset;
    }

    // Bug 16004 prevents us from just inheriting principals from the URL, there
    // for we use system principal if it's a chrome URL.
    if (response.principalURI.indexOf('chrome:') === 0)
      channel.owner = chromePrincipal;
    // If `principalURI` is set to anything other then an `request.uri` and
    // it's not a chrome URI channel will have principals of the URL.
    else if (response.principalURI !== response.uri)
      channel.owner = Principal(URI(response.principalURI, null, null));

    return channel;
  }
});
exports.CoreProtocol = CoreProtocol;
