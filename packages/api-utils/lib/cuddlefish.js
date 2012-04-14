/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
!function(factory) {
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(exports) === 'object') { // CommonJS
    factory(require, exports);
  } else if (~String(this).indexOf('BackstagePass')) { // JSM
    factory(undefined, this);
    this.EXPORTED_SYMBOLS = Object.keys(this);
  } else {
    factory(undefined, (this.loader = {}));
  }
}.call(this, function(_, exports) {

'use strict';

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();
const scriptLoader = Cc['@mozilla.org/moz/jssubscript-loader;1'].
                     getService(Ci.mozIJSSubScriptLoader);
const observerService = Cc['@mozilla.org/observer-service;1'].
                        getService(Ci.nsIObserverService);

/* hack to declare dependency on:
require('api-utils/addon/runner')
*/

// Define some shortcuts.
const getOwnPropertyNames = Object.getOwnPropertyNames;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const defineProperties = Object.defineProperties;
const getPrototypeOf = Object.getPrototypeOf;
const create = Object.create;

// Workaround for bug 674195. Freezing objects from other compartments fail,
// so we use `Object.freeze` from the same component instead.
function freeze(object) {
  if (getPrototypeOf(object) === null) {
      Object.freeze(object);
  }
  else {
    getPrototypeOf(getPrototypeOf(object.isPrototypeOf)).
      constructor. // `Object` from the owner compartment.
      freeze(object);
  }
  return object;
}

function getOwnPropertiesDescriptor(object) {
  let descriptor = {};
  getOwnPropertyNames(object).forEach(function(name) {
    descriptor[name] = getOwnPropertyDescriptor(object, name)
  });
  return descriptor;
}

const override = lambda(function override(target, properties) {
  return defineProperties(target, getOwnPropertiesDescriptor(properties));
});
exports.override = override;

function lambda(f, prototype) {
  f.prototype = prototype && freeze(prototype);
  return freeze(f);
}

// Freeze important built-ins so they can't be used for message passing.
freeze(Object.prototype);
freeze(Function.prototype);
freeze(Array.prototype);

const Sandbox = lambda(function Sandbox(options) {
  let { principal, prototype, name, sandbox, wantXrays } = override({
    principal: systemPrincipal,
    prototype: {},
    wantXrays: false,
    sandbox: null
  }, options);

  options = {
    sandboxPrototype: prototype,
    wantXrays: wantXrays,
    sandboxName: name,
    sameGroupAs: sandbox
  };

  // Need to make sure we don't have a sandbox here.
  if (!sandbox)
    delete options.sameGroupAs;

  return Cu.Sandbox(principal, options);
});
exports.Sandbox = Sandbox;

// Evaluates code from the given `uri` into given sandbox. If `options.source`
// is passed, then that `source` is evaluated instead.
const evaluate = lambda(function evaluate(sandbox, uri, options) {
  let { source, line, version, encoding } = override({
    encoding: 'UTF-8',
    line: 1,
    version: '1.8',
    source: null
  }, options || {});

  return source ? Cu.evalInSandbox(source, sandbox, version, uri, line)
                : scriptLoader.loadSubScript(uri, sandbox, encoding);
});
exports.evaluate = evaluate;

// populate a Module by evaluating the CommonJS module code in the sandbox
const load = lambda(function load(loader, module) {
  let { sandboxes, globals } = loader;
  let require = Require(loader, module);

  let sandbox = sandboxes[module.path] = Sandbox({
    name: module.uri,
    // Get an existing module sandbox, if any, so we can reuse its compartment
    // when creating the new one to reduce memory consumption.
    sandbox: sandboxes[Object.keys(sandboxes).shift()],
    prototype: globals
  });

  override(sandbox, globals);
  override(sandbox, {
    require: require,
    module: module,
    exports: module.exports
  });

  evaluate(sandbox, module.uri);

  if (module.exports && typeof(module.exports) === 'object')
    freeze(module.exports);

  return module;
});
exports.load = load;

const Require = lambda(function Require(loader, { path: base }) {
  let { prefixURI, modules } = loader;
  let manifest = loader.manifest[base];
  let requirer = modules[base];
  return lambda(override(function require(id) {
    if (!id)
      throw Error("you must provide a module name when calling require() from "
                  + (requirer && requirer.id), base, id);

    // If we have a manifest for requirer, then all it's requirements have been
    // registered by linker and we should have a `path` to the required module.
    // Even pseudo-modules like 'chrome', 'self', '@packaging', and '@loader'
    // have pseudo-paths: exactly those same names.
    // details see: Bug-697422.
    let module, requirement = manifest && manifest.requirements[id];
    if (!requirement)
        throw Error("Module: " + (requirer && requirer.id) + ' located at ' +
                    base + " has no authority to load: " + id);
    let path = requirement.path;

    if (path in modules) {
      module = modules[path];
    }
    else {
      let uri = prefixURI + path;
      module = modules[path] = Module(id, path, uri);
      load(loader, module);
      freeze(module);
    }

    // "magic" modules which have contents that depend upon who imports them
    // (like "self") are expressed in the Loader's pre-populated 'modules'
    // table as callable functions, which are given the reference to this
    // Loader and a copy of the importer's URI
    //
    // TODO: Find a better way to implement `self`.
    // Maybe something like require('self!path/to/data')
    if (typeof(module) === 'function')
      module = module(loader, requirer);

    return module.exports;
  }, { main: loader.main }));
});
exports.Require = Require;

// Makes module object that is made available to CommonJS modules when they
// are evaluated, along with 'exports' and 'uri'.
const Module = lambda(function Module(id, path, uri) {
  return create(Object.prototype, {
    id: { enumerable: true, value: id },
    exports: { enumerable: true, writable: true, value: create(null) },
    // Keep non-standard properties non-enumerable.
    path: { value: path },
    uri: { value: uri }
  })
});
exports.Module = Module;

const unload = lambda(function unload(loader, reason, callback) {
  observerService.notifyObservers(null, loader.unloadTopic, reason);
  if (typeof(callback) === 'function') callback();
});
exports.unload = unload;

const Loader = lambda(function Loader(options) {
  let { mainID, mainPath, prefixURI, manifest, modules, globals } = override({
    manifest: {},
    modules: Object.prototype,
    globals: {},
    print: dump,
  }, options);
  options.unloadTopic = 'sdk:destroy:loader:' + options.id;

  let main = Module(mainID, mainPath, prefixURI + mainPath);
  modules = create(modules);

  let loader = freeze({
    main: main,
    unloadTopic: options.unloadTopic,
    // Manifest generated by a linker, containing map of module url's mapped
    // to it's requirements, comes from harness-options.json
    manifest: manifest,
    // Following property may be passed in (usually for mocking purposes) in
    // order to override default modules cache.
    modules: modules,
    globals: globals,
    prefixURI: prefixURI,
    sandboxes: {}
  });

  // set up default modules
  modules[mainPath] = main;
  override(modules, {
    '@packaging': freeze({
      id: '@packaging',
      exports: JSON.parse(JSON.stringify(options))
    }),
    '@loader': freeze({
      exports: freeze(override(create(null), exports)),
      id: '@loader'
    }),
    '@chrome': freeze({
      id: '@chrome',
      exports: freeze({
        Cc: Cc,
        CC: CC,
        Ci: Ci,
        Cu: Cu,
        Cr: Cr,
        Cm: Cm,
        components: Components
      }),
    }),
    'chrome': freeze({
      id: 'chrome',
      get exports() {
        // TODO: Add deprecation warnings here!
        return loader.modules['@chrome'].exports;
      }
    }),
    // TODO: Deprecate this `self` and switch to non-magic self.
    'self': function self(loader, requirer) {
      let loaderURI = loader.modules['@packaging'].exports.loader;
      let require = Require(loader, { path: loaderURI });
      return require('api-utils/self!').create(requirer.path);
    }
  });

  return loader;
});
exports.Loader = Loader;

});
