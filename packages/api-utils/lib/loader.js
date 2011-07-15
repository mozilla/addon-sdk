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

// @see http://mxr.mozilla.org/mozilla-central/source/js/src/xpconnect/loader/mozJSComponentLoader.cpp
var EXPORTED_SYMBOLS = [ 'Loader' ]

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;
const { registerFactory, unregisterFactory } =
        Cm.QueryInterface(Ci.nsIComponentRegistrar);
const { generateUUID } = CC('@mozilla.org/uuid-generator;1',
                            'nsIUUIDGenerator')();
const ioService = CC('@mozilla.org/network/io-service;1', 'nsIIOService')();
const resolveURI = ioService.getProtocolHandler('resource').
                   QueryInterface(Ci.nsIResProtocolHandler).resolveURI;
const StandardURL = CC('@mozilla.org/network/standard-url;1',
                       'nsIStandardURL', 'init');
const Pipe = CC('@mozilla.org/pipe;1', 'nsIPipe', 'init')
const Channel = CC('@mozilla.org/network/input-stream-channel;1',
                   'nsIInputStreamChannel')

const URI = ioService.newURI.bind(ioService)
const URIChannel = ioService.newChannelFromURI.bind(ioService)


function equals(value) this.equals(value)

const Loader = {
  // XPCOM
  classID: generateUUID(),
  classDescription: 'Jetpack module loader service',
  contractID: '@mozilla.org/network/protocol;1?name=jpm',
  interfaces: [
    Ci.nsISupports,
    Ci.nsISupportsWeakReference,
    Ci.nsIProtocolHandler
  ],
  QueryInterface: function QueryInterface(iid) {
    if (!this.interfaces.some(equals, iid))
      throw Cr.NS_ERROR_NO_INTERFACE;

    return this;
  },
  createInstance: function(outer, iid) {
    try {
      if (outer)
        throw Cr.NS_ERROR_NO_AGGREGATION;
      return this.QueryInterface(iid);
    } catch (error) {
      console.exception(error)
      throw error instanceof Ci.nsIException ? error : Cr.NS_ERROR_FAILURE;
    }
  },
  get wrappedJSObject() this,
  register: function register() {
    registerFactory(this.classID, this.classDescription, this.contractID, this);
    return this;
  },
  unregister: function() {
    unregisterFactory(this.classID, this)
    return this;
  },

  // nsIProtocolHandler

  scheme: 'jpm',
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
  newURI: function newURL(relative, charset, base) {
    let uri = StandardURL(this.type, this.defaultPort, relative, charset, base);
    uri.QueryInterface(Ci.nsIURL);
    return uri;
  },
  newChannel: function newChannel(uri) {
    try {
    let channel, pipe, resourceURI, resourceChannel, resourceStream, adapter;
    // Getting resource URI of the given URI.
    resourceURI = URI(uri.spec.replace(uri.scheme, 'resource'), null, null);
    // Creating a channel for the resource.
    resourceChannel = URIChannel(resourceURI)
    // Opening a input stream for the resource.
    resourceStream = resourceChannel.open();

    adapter = this.makeModuleAdapter(uri.spec);


    pipe = Pipe(true, true, 0, 0, null);

    channel = Channel();
    channel.setURI(URI(resolveURI(resourceURI), null, null));
    console.log(URI(resolveURI(resourceURI), null, null).spec)
    channel.contentStream = pipe.inputStream;
    channel.QueryInterface(Ci.nsIChannel);

    pipe.outputStream.write(adapter, adapter.length);
    pipe.outputStream.writeFrom(resourceStream, resourceStream.available());
    pipe.outputStream.close();

    return channel;
    } catch (error) {
      console.exception(error);
      throw error;
    }
  },

  makeModuleAdapter: function makeModuleAdapter(id) {
    return [
      'const EXPORTED_SYMBOLS = [ "module" ];',
      'const module = { exports: {}, id: "' + id + '", uri: "' + id + '" };',
      'const exports = module.exports;',
      'let require = Components.classes["' + this.contractID + '"]',
                     '.createInstance(Components.interfaces.nsISupports)',
                     '.wrappedJSObject',
                     '.require.bind(null, "' + id + '");'
    ].join('')
  },

  require: function require(baseURI, id) {
    baseURI = baseURI ? URI(baseURI, null, null) : null;
    id = ioService.newURI(id, null, baseURI).spec;
    let module = Cu.import(id, null);
    return Object.freeze(module.exports);
  },
  main: function main(id) {
    return this.require(null, id);
  }
}.register();

// Usage:
// require('api-utils/loader'); // Register new loader
// // get a loader.
// let loader = Components.classes['@mozilla.org/network/protocol;1?name=jpm'].
//              createInstance(Components.interfaces.nsISupports).wrappedJSObject;
// let foo = loader.main('jpm://jep4repl-at-jetpack-api-utils-lib/module.js');
