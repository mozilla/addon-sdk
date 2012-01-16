/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { Cc, Ci, CC } = require('chrome');
const { Service } = require('./xpcom');
const { Base } = require('./base');
const { CustomURL } = require('./xpcom/uri');
const { ns } = require('./namespace');

const StandardURL = CC('@mozilla.org/network/standard-url;1',
                       'nsIStandardURL', 'init');
const Pipe = CC('@mozilla.org/pipe;1', 'nsIPipe', 'init');
const Channel = CC('@mozilla.org/network/input-stream-channel;1',
                   'nsIInputStreamChannel');
const SecurityManager = Cc['@mozilla.org/scriptsecuritymanager;1'].
                        getService(Ci.nsIScriptSecurityManager);
const Principal = SecurityManager.getCodebasePrincipal;
const chromePrincipal = Cc['@mozilla.org/systemprincipal;1'].
                        createInstance(Ci.nsIPrincipal);
const IOService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const URI = IOService.newURI.bind(IOService);
const URIChannel = IOService.newChannel;


const { ALLOW_SCRIPT, URI_SAFE_FOR_UNTRUSTED_CONTENT,
        HIDE_FROM_ABOUTABOUT } = Ci.nsIAboutModule;

const { URI_STD, URI_NORELATIVE, URI_NOAUTH, URI_INHERITS_SECURITY_CONTEXT,
        URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT, URI_LOADABLE_BY_ANYONE,
        URI_DANGEROUS_TO_LOAD, URI_IS_UI_RESOURCE, URI_IS_LOCAL_FILE,
        URI_LOADABLE_BY_SUBSUMERS, URI_NON_PERSISTABLE, URI_IS_LOCAL_RESOURCE,
        URI_DOES_NOT_RETURN_DATA, URI_OPENING_EXECUTES_SCRIPT, ALLOWS_PROXY,
        ALLOWS_PROXY_HTTP } = Ci.nsIProtocolHandler;

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

const AbstractHandler = {
  onRequest: function onRequest() { throw Error('Not implemented') },
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
}
exports.AbstractHandler = AbstractHandler;

const AboutHandler = Service.extend(AbstractHandler, {
  get what() { throw Error('Property `what` is required') },
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
  get classDescription() 'Protocol handler for "about:' + this.what + '"',
  get contractID() '@mozilla.org/network/protocol/about;1?what=' + this.what,
  getURIFlags: function(uri)
    this.allowScript ? ALLOW_SCRIPT : 0 |
    this.allowUnsafeLinks ? URI_SAFE_FOR_UNTRUSTED_CONTENT : 0 |
    this.allowListing ? HIDE_FROM_ABOUTABOUT : 0
});
exports.AboutHandler = AboutHandler;

const ProtocolHandler = Service.extend(AbstractHandler, Flags, URITypes, {
  onResolve: function onResolve() { throw Error('Not implemented') },
  interfaces: [ 'nsIProtocolHandler' ],
  get classDescription() 'Protocol handler for "' + this.scheme + ':*"',
  get contractID() '@mozilla.org/network/protocol;1?name=' + this.scheme,
  // Feel free to override.
  allowPort: function(port, scheme) false,
  defaultPort: -1,
  // For more information on what these flags mean,
  // https://developer.mozilla.org/en/nsIProtocolHandler#Constants
  protocolFlags: URI_NORELATIVE | URI_DANGEROUS_TO_LOAD,
  URI_STD: URI_STD,
  URI_NORELATIVE: URI_NORELATIVE,
  URI_NOAUTH: URI_NOAUTH,
  URI_INHERITS_SECURITY_CONTEXT: URI_INHERITS_SECURITY_CONTEXT,
  URI_LOADABLE_BY_ANYONE: URI_LOADABLE_BY_ANYONE,
  URI_DANGEROUS_TO_LOAD: URI_DANGEROUS_TO_LOAD,
  URI_IS_UI_RESOURCE: URI_IS_UI_RESOURCE,
  URI_IS_LOCAL_FILE: URI_IS_LOCAL_FILE,
  URI_LOADABLE_BY_SUBSUMERS: URI_LOADABLE_BY_SUBSUMERS,
  URI_NON_PERSISTABLE: URI_NON_PERSISTABLE,
  URI_IS_LOCAL_RESOURCE: URI_IS_LOCAL_RESOURCE,
  URI_DOES_NOT_RETURN_DATA: URI_DOES_NOT_RETURN_DATA,
  URI_OPENING_EXECUTES_SCRIPT: URI_OPENING_EXECUTES_SCRIPT,
  ALLOWS_PROXY: ALLOWS_PROXY,
  ALLOWS_PROXY_HTTP: ALLOWS_PROXY_HTTP,

  /**
   * Property describe how to normalize an URL.
   * @see https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIStandardURL#Constants
   */
  type: 1,
  newURI: function newURI(relative, charset, base) {
    // If protocol handler defines URI resolution use `CustomURL` implementation
    // to allow protocols like 'about:addons'. Otherwise fallback to
    // `standardURL`.
    return this.onResolve !== ProtocolHandler.onResolve ?
           CustomURL.new(this.onResolve(relative, base && base.spec, charset)) :
           this.newURL(relative, charset, base);
  },
  newURL: function newURL(relative, charset, base) {
    var url = StandardURL(this.type, this.defaultPort, relative, charset, base);
    url.QueryInterface(Ci.nsIURL);
    return url;
  }
});
exports.ProtocolHandler = ProtocolHandler;
