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
const resourceHandler = ioService.getProtocolHandler('resource').
                        QueryInterface(Ci.nsIResProtocolHandler);
const StandardURL = CC('@mozilla.org/network/standard-url;1',
                       'nsIStandardURL', 'init');
const Pipe = CC('@mozilla.org/pipe;1', 'nsIPipe', 'init');
const Channel = CC('@mozilla.org/network/input-stream-channel;1',
                   'nsIInputStreamChannel');

const URI = ioService.newURI.bind(ioService);
const URIChannel = ioService.newChannelFromURI.bind(ioService);
const resolveURI = resourceHandler.resolveURI.bind(resourceHandler);


// TODO: Fix on linker side!
// Following utility function are hopefully a temporary hacks, used to get an
// add-on root from a module URI of a given add-on. This way if `uri` is:
// `resource://jep4repl-at-jetpack-api-utils-lib/unload.js`
// this function will return: `resource://jep4repl-at-jetpack-api`
function getAddonPrefix(uri) {
    return uri.substr(0, uri.indexOf('-at-jetpack')) + '-at-jetpack'
}
// This another hack, it takes base URI and absolute id to compose a URI of
// the given id.
function getModuleURI(base, id) {
  let paths = id.split('/');
  let packageName = paths.shift();
  return getAddonPrefix(base) + '-' + packageName + '-lib/' + paths.join('/');
}

// TODO: Make this independent of `packaging` global.
// Following two hacks are used to emulate desired integration with linker.
// Since at the moment Loader is used as a module it has access to the global
// `packaging`. It would be way better if something like:
// `require('module://package/manifest.js')` would have returned a manifest
// for the `package`. Since that requires changes both on the linker and
// a bootstrap code we workaround it.
function getModuleManifest(id) {
  return packaging.options.manifest[id]
}
// This is yet another hack that ideally should be removed in favor of
// `manifest[id]`, but since manifest contains 'resource://' type URLs we use
// this hack to convert such URIs to 'module://' type.
function resolveRequirement(manifest, id) {
  let requirement = manifest[id]
  return requirement ? requirement.replace('resounce://', 'module://')
                     : requirement
}

function normalize(id) id.substr(-3) === '.js' ? id : id + '.js'
function isRelative(id) id.indexOf('.') === 0
function equals(value) this.equals(value)

const Loader = {
  // XPCOM Boilerplate:
  classID: generateUUID(),
  classDescription: 'Jetpack module loader service',
  get contractID() '@mozilla.org/network/protocol;1?name=' + this.scheme,
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

  // Implementation of `nsIProtocolHandler` interface.

  scheme: 'module',
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
    let channel, pipe, resourceURI, resourceStream, header, footer
    // Getting resource URI of the given URI.
    resourceURI = URI(uri.spec.replace(uri.scheme, 'resource'), null, null);
    // Creating a channel for the resource and open an input stream.
    resourceStream = URIChannel(resourceURI).open();

    pipe = Pipe(true, true, 0, 0, null);

    channel = Channel();
    channel.setURI(URI(resolveURI(resourceURI), null, null));
    channel.contentStream = pipe.inputStream;
    channel.QueryInterface(Ci.nsIChannel);

    header = this.Header(uri.spec, resourceURI.spec);
    pipe.outputStream.write(header, header.length);
    pipe.outputStream.writeFrom(resourceStream, resourceStream.available());
    pipe.outputStream.write(this.footer, this.footer.length);
    pipe.outputStream.close();

    return channel;
  },


  // Module loader:
  modules: {
    'chrome.js': {
      exports: { Cc: Cc, CC: CC, Ci: Ci, Cu: Cu, Cr: Cr, Cm: Cm,
                 components: Components },
      id: 'chrome'
    },
    // TODO: Remove this temporary hack and use real solution instead.
    '@globals.js': {
      exports: {
        console: console,
        memory: memory
      },
      id: '@globals'
    }
  },
  Header: function Header(id, uri) {
    return [
      'const EXPORTED_SYMBOLS = [ "module" ];',
      'const module = { exports: {}, id: "' + id + '", uri: "' + uri + '" };',
      'const exports = module.exports;',
      'let require = Components.classes["' + this.contractID + '"]',
                     '.createInstance(Components.interfaces.nsISupports)',
                     '.wrappedJSObject',
                     '.require.bind(null, "' + id + '");',
      'let global = require("@globals");',
      'for (let key in global) this[key] = global[key];',
      'try { (function (Components) { '
    ].join('')
  },
  footer: '\n/**/})() } catch (error) { module.error = error; }',
  require: function require(base, id) {
    let manifest, imported;

    id = normalize(id); // Ensure that id has file extension.

    // If we have a base module and it's in manifest, then all it's
    // dependencies must be in the manifest.
    if (base && (manifest = getModuleManifest(base))) {
      let requirement = resolveRequirement(manifest, id);
      // If module has 'sudo' privileges, it can go off-manifest.
      if (requirement || 'chrome' in manifest)
        requirement = id;

      id = requirement;
    }

    // If it's relative id, then we just resolve it to a base one.
    if (isRelative(id))
      id = URI(id, null, URI(base, null, null)).spec;

    // If it's not a relative id, and we have a base, we assemble module ID.
    else if (!(id in Loader.modules) && base)
      id = URI(getModuleURI(base, id), null, null).spec;

    console.log(id)
    // Importing a module.
    if (id in Loader.modules)
      return Loader.modules[id].exports;

    Cu.import(id, imported = {});

    if ('error' in imported.module)     // Throw error
      throw imported.module.error;
    else                                // Return frozen module exports.
      return Object.freeze(imported.module.exports);
  },
  main: function main(id) {
    return this.require(null, id);
  }
}.register();

// Usage:
// require('api-utils/loader'); // Register new loader
// let loader = Components.classes['@mozilla.org/network/protocol;1?name=module'].createInstance(Components.interfaces.nsISupports).wrappedJSObject;
// loader.main('module://jep4repl-at-jetpack-api-utils-lib/array.js');

