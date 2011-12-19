/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true browser: true
         forin: true latedef: false globalstrict: true */
/*global define: true */

'use strict';

const { Cc, Ci, components: { Constructor: CC } } = require('chrome')
const { Factory } = require('./xpcom');
const { Base } = require('./selfish');
const { CustomURL } = require('./xpcom/uri');
const { Namespace: ns } = require('./namespace');

const StandardURL = CC('@mozilla.org/network/standard-url;1',
                       'nsIStandardURL', 'init');
const Pipe = CC('@mozilla.org/pipe;1', 'nsIPipe', 'init');
const Channel = CC('@mozilla.org/network/input-stream-channel;1',
                   'nsIInputStreamChannel');
const SecurityManager = Cc['@mozilla.org/scriptsecuritymanager;1'].
                        getService(Ci.nsIScriptSecurityManager);
const Principal = SecurityManager.getCodebasePrincipal;
const IOService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const URI = IOService.newURI.bind(IOService);
const URIChannel = IOService.newChannel;

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
      contentType: ''
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
  onRequest: function throw Error('Not implemented'),
  newChannel: function newChannel(uri) {
    let channel, pipe, response, request;

    // We create `nsIPipe` which where response's output will be forwarded to.
    pipe = Pipe(true, true, 0, 0, null);
    response = Response.new(request.uri, pipe.outputStream);
    request = { uri: uri.spec };

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

      // Copy length & type of the content from the response, which will default
      // to undefined indicating that length & type are unknown.
      channel.contentLength = response.contentLength;
      channel.contentType = response.contentType;
    }

    // If `principalURI` is set to anything other then an `request.uri` it
    // means that channel owner must be different and it's privileges must be
    // inherited. This feature is handy, for a custom URI implementers that
    // proxy to a content of the different URIs.
    if (response.principalURI !== response.uri)
      channel.owner = Principal(URI(response.principalURI, null, null));

    return channel;
  }
}
exports.AbstractHandler = AbstractHandler;

const AboutHandler = Factory.extend(AbstractHandler, {
  interfaces: [ 'nsIAboutModule' ],
  get classDescription() 'Protocol handler for "about:' + this.scheme + '"',
  get contractID() '@mozilla.org/network/protocol/about;1?what=' + this.scheme,
  getURIFlags: function(uri) Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT
});
exports.AboutHandler = AboutHandler;

const ProtocolHandler = Factory.extend(AbstractHandler, {
  onResolve: function onResolve() throw Error('Not implemented'),
  interfaces: [ 'nsIProtocolHandler' ],
  get classDescription() 'Protocol handler for "' + this.scheme + ':*"',
  get contractID() '@mozilla.org/network/protocol;1?name=' + this.scheme,
  // Feel free to override.
  allowPort: function(port, scheme) false,
  defaultPort: -1,
  // For more information on what these flags mean,
  // see caps/src/nsScriptSecurityManager.cpp.
  protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE
               | Ci.nsIProtocolHandler.URI_IS_UI_RESOURCE
               | Ci.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD,
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
