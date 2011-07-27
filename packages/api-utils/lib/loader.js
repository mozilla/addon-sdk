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

// @see http://mxr.mozilla.org/mozilla-central/source/js/src/xpconnect/loader/mozJSComponentLoader.cpp

var EXPORTED_SYMBOLS = [ 'Loader' ];

(function(exports) {

"use strict";

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;
const { registerFactory, unregisterFactory } =
        Cm.QueryInterface(Ci.nsIComponentRegistrar);
const { generateUUID } = CC('@mozilla.org/uuid-generator;1',
                            'nsIUUIDGenerator')();
const ioService = CC('@mozilla.org/network/io-service;1', 'nsIIOService')();

const URI = ioService.newURI.bind(ioService);
const Channel = ioService.newChannel.bind(ioService);
const ScriptableInputStream = CC('@mozilla.org/scriptableinputstream;1',
                                 'nsIScriptableInputStream', 'init');
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();


function normalize(id) id.substr(-3) === '.js' ? id : id + '.js'
function isRelative(id) id.indexOf('.') === 0
function equals(value) this.equals(value)
function resolve(id, base) {
  var path, paths, last
  if (!isRelative(id)) return id
  paths = id.split('/')
  base = base ? base.split('/') : [ '.' ]
  if (base.length > 1) base.pop()
  while ((path = paths.shift())) {
    if (path === '..') {
      if (base.length && base[base.length - 1] !== '..') {
        if (base.pop() === '.') base.push(path)
      } else base.push(path)
    } else if (path !== '.') {
      base.push(path)
    }
  }
  if (base[base.length - 1].substr(-1) === '.') base.push('')
  return base.join('/')
}
function resolveURI(root, id) {
  let paths = normalize(id).split('/')
  return paths.length <= 1 ? id :
         [root + paths.shift() + '-lib'].concat(paths).join('/');

}

function Require(loader, base) {
  function require(id) {
    let manifest;

    // If we have a base module and it's in manifest, then all it's
    // dependencies must be in the manifest.
    if (base && (manifest = loader.manifest[base.uri])) {
      let requirement = manifest.requirements[id];
      // If module has 'sudo' privileges, it can go off-manifest.
      if (requirement || 'chrome' in manifest.requirements)
        requirement = id;
      else
        throw new Error("Module: " + base.id + " has no athority to load: " + id);

      id = requirement
    }

    console.log(id)

    id = resolve(id, base && base.id)

    // Importing a module.
    console.log(id)
    return loader.load(id);
  }
  require.main = loader.main;
  return require;
}

function Main(loader) {
  return function main(id) {
    loader.main = loader.modules[id] = {};
    return Require(loader, null)(id);
  }
}

const Loader = Object.freeze({
  // XPCOM Boilerplate:
  classID: generateUUID(),
  classDescription: 'Jetpack module loader service',
  contractID: '@mozilla.org/jetpack/module-loader;1',
  interfaces: [
    Ci.nsISupports,
    Ci.nsISupportsWeakReference,
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

  // Module loader:
  new: function () {
    let loader = Object.create(Loader);
    Loader.initialize.apply(loader, arguments);
    return loader;
  },
  initialize: function initialize(options) {
    this.metadata = options.metadata;
    this.manifest = options.manifest;
    this.root = options.uriPrefix;
    // this.modules['@globals'] = this.load('@globals.js')
    this.main = Main(this);
  },
  modules: {
    'chrome.js': {
      exports: { Cc: Cc, CC: CC, Ci: Ci, Cu: Cu, Cr: Cr, Cm: Cm,
                 components: Components },
      id: 'chrome'
    },
    // TODO: Remove this temporary hack and use proper solution instead.
    'self.js': {
      exports: require('self'),
      id: 'self'
    }
  },
  load: function load(id) {
    let uri = resolveURI(this.root, normalize(id));
    let module = this.modules[uri] || (this.modules[uri] = {})

    if (module.exports)
      return module.exports;

    module.id = id;
    module.uri = uri;
    module.main = this.main;
    module.exports = {};

    let inputStream = ScriptableInputStream(Channel(uri, null, null).open());
    let source = inputStream.readBytes(inputStream.available());
    let sandbox = Cu.Sandbox(systemPrincipal, {
      //sandboxPrototype: this.modules['@globals'],
      sandboxPrototype: {
        module: module,
        exports: module.exports,
        Components: undefined,
        require: Require(this, module)
      },
      wantXrays: false,
    });
    Cu.evalInSandbox(source, sandbox, '1.8', uri, 1);

    return Object.freeze(Object.freeze(module).exports);
  }
});
exports.Loader = Loader;

})(typeof(exports) === 'undefined' ? this : exports);

// Once it will move to bootstrap.js
//
// // Register a module loader if not registered already.
// if (!(Loader.contractID in Cc))
//  Loader.register()

//let loader = Cc[Loader.contractID].createInstance(Ci.nsISupports).
//              wrappedJSObject.new(packaging.options);
//
// // Set up add-on hooks
// install = loader.install
// startup = loader.startup
// shutdown = loader.shutdown
// uninstall = loader.uninstall
//
// // Argument should point to the URI of the main module instead.
// loader.main('resource://jep4repl-at-jetpack-api-utils-lib/main.js')

// Use today:
//
//let { Cc, Ci } = require('chrome');
//let Loader = require('api-utils/loader').Loader;
//// Register a module loader if not registered already.
//if (!(Loader.contractID in Cc))
//  Loader.register()

//let loader = Cc[Loader.contractID].createInstance(Ci.nsISupports).
//              wrappedJSObject.new(packaging.options);
//let self = loader.main('api-utils-lib/@self.js')
//let { Panel } = self.require('addon-kit/panel');
