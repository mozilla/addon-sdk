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

!function(exports) {

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

// Normalizes `uri`, so that it contains `.js` file extension.
function normalize(uri) uri.substr(-3) === '.js' ? uri : uri + '.js'

// Returns `true` if given `id` is relative.
function isRelative(id) id.indexOf('.') === 0

// Resolves given `id` to the `base` one, if it's a relative.
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

// Utility function that synchronously reads local resource from the given
// `uri` and returns content string.
function readURI(uri) {
  let request = XMLHttpRequest();
  request.open('GET', uri, false);
  request.overrideMimeType('text/plain');
  request.send();
  return request.responseText;
}

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

function Require(loader, manifest, base) {
  function require(id) {
    // TODO: Remove debug log!
    // dump('>>>> ' + base + ' ? ' + id + '\n')
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
        throw new Error("Module: " + base.id + " has no athority to load: " + id);
    }

    // Resolving requirement `id` to it's requirer `id`.
    id = resolve(id, base && base.id);

    // TODO: Remove debug log!
    // dump('require: ' + id + '\n');

    // Loading required module and return it's exports.
    // TODO: Find out which exports fail to freeze and fix those!
    let exports = loader.load(id, base);
    try {
      exports = Object.freeze(exports);
    } catch (error) {
      dump("Failed to freeze exports for module:" + id + "\n");
    }
    return exports;
  }
  require.main = loader.main;
  return require;
}

function Main(loader) {
  return function main(id) {
    // Overriding main so that all modules point to it.
    loader.main = loader.modules[resolveURI(loader.root, id)] = {};
    return Require(loader, null)(id);
  }
}

function Modules(loader, options) {
  return {
    'chrome.js': Object.freeze({
      exports: Object.freeze({
        Cc: Cc,
        CC: CC,
        Ci: Ci,
        Cu: Cu,
        Cr: Cr,
        Cm: Cm,
        components: Components,
        env: exports
      }),
      id: 'chrome'
    }),
    'parent-loader.js': Object.freeze({
      exports: loader,
      id: 'parent-loader'
    }),
    '@loader.js': Object.freeze({
      exports: Object.freeze({ Loader: Loader }),
      id: '@loader'
    }),
    '@packaging.js': Object.freeze({
      // Make deep clone to avoid manifest changes at runtime.
      exports: JSON.parse(JSON.stringify(options)),
      id: '@packaging'
    }),
    'self.js': function(loader, requirer) {
      let base = requirer.uri;
      let manifest = loader.manifest[base];
      let moduleData = manifest && manifest.requirements['self'];
      let makeSelf = loader.loader('api-utils/self-maker').makeSelfModule;

      if (!moduleData) {
         // we don't know where you live, so we must search for your data
         // resource://api-utils-api-utils-tests/test-self.js
         // make a prefix of resource://api-utils-api-utils-data/
         let doubleslash = base.indexOf("//");
         let prefix = base.slice(0, doubleslash+2);
         let rest = base.slice(doubleslash+2);
         let slash = rest.indexOf("/");
         prefix = prefix + rest.slice(0, slash);
         prefix = prefix.slice(0, prefix.lastIndexOf("-")) + "-data/";
         moduleData = { dataURIPrefix: prefix };
         // moduleData also wants mapName and mapSHA256, but they're
         // currently unused
      }

      return Object.freeze({
        id: 'self',
        exports: Object.freeze(makeSelf(moduleData))
      })
    }
  }
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

const Loader = Component.extend({
  classDescription: 'Jetpack module loader service',
  contractID: '@mozilla.org/jetpack/module-loader;1',
  classID: Component.classID,
  interfaces: Component.interfaces.concat([Ci.nsISupportsWeakReference]),
  new: function (options) {
    // Register Loader via XPCOM.
    if (!(Loader.contractID in Cc))
      Loader.register();

    let loader = Object.create(Cc[Loader.contractID].
                               createInstance(Ci.nsISupports).wrappedJSObject);
    loader.initialize(options);

    return loader;
  },
  initialize: function initialize(options) {
    // TODO: This is unnecessary overhead add-on already has resource URI which
    // we should use, it's just packages should be aligned so that they can map
    // easily to the module IDs.
    mapResources(options.uri, options.resources);

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
      this.sandbox = Sandbox.new(this.globals);
    else
      this.sandboxes = {};

    // Use modules if they were provided or create default one.
    this.modules = options.modules || Modules(this, options);

    // TODO: Also adding legacy global that some code depends on, which should
    // migrate to require("packaging") or similar instead.
    this.globals = {
      packaging: { jetpackID: options.jetpackID, options: options }
    };
    // Loading globals for special module and put them into loader globals.
    let globals = this.load('api-utils/@globals');
    Object.keys(globals).forEach(function(name) {
      this.globals[name] = globals[name];
    }, this);

    this.main = Main(this);
  },
  load: function load(id, base) {
    let uri = resolveURI(this.root, normalize(id));
    let module = this.modules[uri] || (this.modules[uri] = {});

    // TODO: Find a better way to implement `self`.
    // Maybe something like require('self!path/to/data')
    if (typeof(module) === 'function')
      module = module(this, base);

    if (module.exports)
      return module.exports;

    module.id = id;
    module.uri = uri;
    module.main = this.main;
    module.exports = {};

    let manifest = this.manifest[uri];
    let exports = module.exports;

    let source;
    try {
      source = readURI(uri);
    } catch(error) {
      throw new Error('Module: ' + id + ' was not fonud: ' + uri)
    }
    let sandbox = this.sandbox || (this.sandboxes[uri] = Sandbox.new(this.globals));
    let factory;
    try {
      factory = sandbox.evaluate('(function(require, exports, module) {' + source + ' })', uri);
      factory.call(exports, Require(this, manifest, module), exports, module);
    } catch(error) {
      dump(error.fileName + '#' + error.lineNumber + '\n')
      dump(error.message + '\n')
      dump(error.stack + '\n')
      throw error
    }

    return Object.freeze(module).exports;
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

/**
 * Maps each path - value from `resources` hash in the resources protocol
 * handler with an associated key. Each path is resolved relative to the given
 * `root` path.
 */
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
};

exports.uninstall = function uninstall(data, reason) {
};

exports.startup = function startup(data, reason) {
  let uri = (data.resolveURI || resourceURI(data.installPath)).spec;
  let options = JSON.parse(readURI(resolve('./harness-options.json', uri)));
  let mainID = resolve('./' + options.main, options.name);
  options.uri = uri;

  let loader = Loader.new(options);

  // TODO: Also does not feels right to defer loading an add-on, but doing so
  // to match behavior of the legacy module loader.
  let observres = loader.load('api-utils/observer-service');
  observres.add('sessionstore-windows-restored', function onReady() {

    /* Disable loading main module, instead we load spawn up a process, into
       which main module will be loaded instead!

    // Load a main module.
    let main = loader.main(mainID);
    // Jetpack calls main function of the main module. Is this legacy or
    // intentional.
    if (main.main)
      main.main();
    */

    let process = loader.main('api-utils/process');
    // Spawning an add-on process for the main module.
    let addon = process.spawn(mainID);
    // Listen to `require!` channel's input messages from the add-on process
    // and load modules being required.
    addon.channel('require!').input(function(id) {
      try {
        loader.load(id).initialize(addon.channel(id));
      } catch (error) {
        /*
        return {
          name: error.name,
          message: error.message,
          stack: error.stack,
          fileName: error.fileName,
          lineNumber: error.lineNumber
        }
        */
        loader.globals.console.exception(error)
      }
    });
  });
};

exports.shutdown = function shutdown(data, reason) {
};

// If module is executed in a different process, then there is a
// `addMessageListener` which we use to register event listen to the `main`
// message on which loader will get bootstrapped and main module executed.
if ('addMessageListener' in exports) {
  exports.addMessageListener('bootstrap', function onMain({ json: { options, id } }) {
    exports.removeMessageListener('bootstrap', onMain);
    try {
      Loader.new(options).main(id);
    } catch (error) {
      dump('Failed to bootstrap process: ' + error.stack + '\n');
    }
  });
}

}(typeof(exports) === 'undefined' ? this : exports);
