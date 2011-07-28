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
const ioService = CC('@mozilla.org/network/io-service;1',
                       'nsIIOService')();
const resourceHandler = ioService.getProtocolHandler('resource')
                        .QueryInterface(Ci.nsIResProtocolHandler);
const XMLHttpRequest = CC('@mozilla.org/xmlextras/xmlhttprequest;1',
                          'nsIXMLHttpRequest');
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();


/**
 * Base construct for defining reusable components.
 */
const Base = Object.freeze(Object.create(Object.prototype, {
  /**
   * Creates an object that inherits from `this` object (Analog of
   * `new Object()`).
   * @examples
   *
   *    var Dog = Base.extend({
   *      bark: function bark() {
   *        return 'Ruff! Ruff!'
   *      }
   *    });
   *    var dog = Dog.new();
   */
  new: { value: function Base() {
    var object = Object.create(this);
    object.initialize.apply(object, arguments);
    return object;
  }},
  /**
   * Method that is called on every `new` instance created, with an arguments
   * that were passed to `new`.
   */
  initialize: { value: function initialize() {
  }},
  /**
   * Takes any number of argument objects and returns frozen, composite object
   * that inherits from `this` object and combines all of the own properties of
   * the argument objects. (Objects returned by this function are frozen as
   * they are intended to be used as types).
   *
   * If two or more argument objects have own properties with the same name,
   * the property is overridden, with precedence from right to left, implying,
   * that properties of the object on the left are overridden by a same named
   * property of the object on the right.
   * @examples
   */
  extend: { value: function extend() {
    // Defining an ES5 property descriptor map, where own property
    // descriptors of all given objects are copied.
    var descriptor = {};
    Array.prototype.forEach.call(arguments, function (properties) {
      Object.getOwnPropertyNames(properties).forEach(function(name) {
        descriptor[name] = Object.getOwnPropertyDescriptor(properties, name);
      });
    });
    return Object.freeze(Object.create(this, descriptor));
  }}
}));


/**
 * Prototype object containing XPCOM creation and registration boilerplate.
 */
const Component = Base.extend({
  classDescription: 'Jetpack generated class',
  contractID: '@mozilla.org/jetpack/component;1',
  get classID() generateUUID(),
  interfaces: [ Ci.nsISupports, Ci.nsIFactory ],
  /**
   * The `QueryInterface` method provides runtime type discovery.
   */
  QueryInterface: function QueryInterface(iid) {
    if (!this.interfaces.some(iid.equals, iid))
      throw Cr.NS_ERROR_NO_INTERFACE;

    return this;
  },
  /**
   * Creates an instance of the class associated with this factory.
   */
  createInstance: function createInstance(outer, iid) {
    try {
      if (outer)
        throw Cr.NS_ERROR_NO_AGGREGATION;
      return this.QueryInterface(iid);
    }
    catch (error) {
      throw error instanceof Ci.nsIException ? error : Cr.NS_ERROR_FAILURE;
    }
  },
  // Part of `nsIFactory`
  lockFactory: function(lock) undefined,
  /**
   * XPConnect lets you bypass its wrappers and access the underlying JS object
   * directly using the `wrappedJSObject` property if the wrapped object allows
   * this.
   */
  get wrappedJSObject() this,
  /**
   * Registers `this` object to be used to instantiate a particular class
   * identified by `this.classID`, and creates an association of class name
   * and `this.contractID` with the class.
   */
  register: function register() {
    registerFactory(this.classID, this.classDescription, this.contractID, this);
    return this;
  },
  /**
   * Unregister a factory associated with a particular class identified by
   * `this.classID`.
   */
  unregister: function unregister() {
    unregisterFactory(this.classID, this);
    return this;
  }
});

function normalize(id) id.substr(-3) === '.js' ? id : id + '.js'
function isRelative(id) id.indexOf('.') === 0
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

// TODO: Remove this temporary hack! Module `id` should map to corresponding
// resource `uri` in more trivial way. I think changing cuddlefish so that
// addons are layout in a simple structure like http://cl.ly/8r99 is the right
// way to go about this.
function resolveURI(root, id) {
  let paths = normalize(id).split('/')
  return paths.length <= 1 ? id :
         [root + paths.shift() + '-lib'].concat(paths).join('/');
}

// TODO: Remove this temporary hack! I think manifest should contain module `id`
// along with or instead of `uri` properties. This function creates parses out
// id out of the `uri`.
function resolveID(root, uri) {
  let paths = uri.replace(root, '').split('/');
  return [ paths.shift().replace(/\-lib$/, '') ].concat(paths).join('/');
}


// Utility function that synchronously reads local resource from the given
// `uri` and returns content string.
function readURI(uri) {
  let request = XMLHttpRequest();
  request.open('GET', uri, false);
  request.send();
  return request.responseText;
}

function Require(loader, manifest, base) {
  function require(id) {
    // TODO: Remove debug log!
    dump(base + ' ? ' + id + '\n')
    // If we have a manifest for requirer, then all it's requirements have been
    // registered by linker.
    if (base && manifest) {
      // If required module is in manifest we use take resolved requirement
      // `id` from manifest.
      let requirement = manifest.requirements[id];
      if (requirement)
        id = requirement.uri ? resolveID(loader.root, requirement.uri) : id;

      // If module is known to have "sudo" privileges, we allow it to go
      // off-manifest. Otherwise we throw an error.
      else if (!('chrome' in manifest.requirements))
        throw new Error("Module: " + base + " has no athority to load: " + id);
    }

    // Resolving requirement `id` to it's requirer `id`.
    id = resolve(id, base);

    // TODO: Remove debug log!
    dump('require: ' + id + '\n');

    // Loading required module and return it's exports.
    return loader.load(id);
  }
  require.main = loader.main;
  return require;
}

const Sandbox = Base.extend({
  initialize: function Sandbox(prototype) {
    this.sandbox = Cu.Sandbox(this.principal, {
      sandboxPrototype: prototype || this.prototype,
      wantXrays: this.wantXrays
    });
  },
  evaluate: function evaluate(source, uri, lineNumber) {
    return Cu.evalInSandbox(
      source,
      this.sandbox,
      this.version,
      uri,
      lineNumber || this.lineNumber
    );
  },
  principal: systemPrincipal,
  version: '1.8',
  lineNumber: 1,
  wantXrays: false,
  prototype: {}
});

function Main(loader) {
  return function main(id) {
    // Overriding main so that all modules point to it.
    loader.main = loader.modules[resolveURI(loader.root, id)] = {};
    return Require(loader, null)(id);
  }
}

const Loader = Component.extend({
  classDescription: 'Jetpack module loader service',
  contractID: '@mozilla.org/jetpack/module-loader;1',
  classID: Component.classID,
  interfaces: Component.interfaces.concat([Ci.nsISupportsWeakReference]),
  initialize: function initialize(options) {
    // Metadata from package.json.
    // Maybe this is obsolete.
    this.metadata = options.metadata;
    // Manifest generated by a linker, containing map of module url's mapped
    // to it's requirements.
    this.manifest = options.manifest;
    // TODO: Hack to allow module URI resolution from ID.
    // Hopefully we'll modify linker in a way that id's will map one on one
    // URIs.
    this.root = options.uriPrefix;
    // If `true` sandboxes will be created per module, otherwise
    // one sandbox will be used for all modules.
    if (options.sandboxes <= 1)
      this.sandbox = Sandbox.new();

    Object.defineProperty(this, 'modules', {
      value: Object.create(this.modules)
    });

    // TODO: Load module globals from module.
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
      exports: {}, //require('self'),
      id: 'self'
    }
  },
  load: function load(id) {
    let uri = resolveURI(this.root, normalize(id));
    let module = this.modules[uri] || (this.modules[uri] = {});

    if (module.exports)
      return module.exports;

    module.id = id;
    module.uri = uri;
    module.main = this.main;
    module.exports = {};

    let manifest = this.manifest[uri];
    let exports = module.exports;

    dump('load: ' + uri + '\n');
    let source;
    try {
      source = readURI(uri);
    } catch(error) {
      throw new Error('Module: ' + id + ' was not fonud: ' + uri)
    }
    let sandbox = this.sandbox || Sandbox.new(this.globals);
    let factory;
    try {
      factory = sandbox.evaluate('(function(require, exports, module) { \n' + source + ' })', uri);
      factory.call(exports, Require(this, manifest, id), exports, module);
    } catch(error) {
      dump(error.fileName + '#' + error.lineNumber + '\n')
      dump(error.message + '\n')
      dump(error.stack + '\n')
      throw error
    }

    return Object.freeze(Object.freeze(module).exports);
  }
});
exports.Loader = Loader;

// Shim function to get `resourceURI` in pre Gecko 7.0.
// https://developer.mozilla.org/en/Extensions/Bootstrapped_extensions#Bootstrap_data
function resourceURI(file) {
  // First creating "file:" URI.
  let uri = ioService.newFileURI(file);
  if (uri.spec.substr(-4) === '.xpi') // `unpack` is `false`
    uri = ioService.newURI('jar:' + uri.spec + '!/', null, null);

  return uri;
}

function mapResources(root, resources) {
  Object.keys(resources).forEach(function(id) {
    let path = resources[id];
    let uri = Array.isArray(path) ? resolve(path.join('/'), root)
                                  : 'file://' + path;
    uri = ioService.newURI(uri + '/', null, null);
    resourceHandler.setSubstitution(id, uri);
    // TODO: Remove debug log!
    dump(id + ' -> ' + uri.spec + '\n');
  });
}

exports.install = function install(data, reason) {
}
exports.uninstall = function uninstall(data, reason) {
}
exports.startup = function startup(data, reason) {
  let uri = (data.resolveURI || resourceURI(data.installPath)).spec;
  let options = JSON.parse(readURI(resolve('./harness-options.json', uri)));
  let mainID = resolve('./' + options.main, options.name);
  if (!(Loader.contractID in Cc))
    Loader.register()
  let loader = Cc[Loader.contractID].createInstance(Ci.nsISupports).
                                     wrappedJSObject.new(options);
  mapResources(uri, options.resources);
  loader.globals = Object.create(loader.load('api-utils/@globals'), {
    packaging: { value: { options: options } }
  });
  loader.main(mainID);
}
exports.shutdown = function shutdown(data, reason) {
}

})(typeof(exports) === 'undefined' ? this : exports);

// Use today:
//
//let { Cc, Ci } = require('chrome');
//let Loader = require('api-utils/loader').Loader;
//// Register a module loader if not registered already.
//if (!(Loader.contractID in Cc)) Loader.register()

//let loader = Cc[Loader.contractID].createInstance(Ci.nsISupports).
//              wrappedJSObject.new(packaging.options);
//              // Or following for using one sandbox.
//              // wrappedJSObject.new(Object.create(packaging.options, {
//              //      sandboxes: { value: 1 }
//              // });
//let self = loader.main('api-utils/@self');
//let { Panel } = self.require('addon-kit/panel');

