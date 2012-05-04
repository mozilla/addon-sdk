/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
!function(factory) {
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(exports) === 'object') { // CommonJS
    factory(require, exports, module);
  } else if (~String(this).indexOf('BackstagePass')) { // JSM
    factory(undefined, this, { uri: __URI__ });
    this.EXPORTED_SYMBOLS = Object.keys(this);
  } else {
    factory(undefined, (this.loader = {}), { uri: document.location.href });
  }
}.call(this, function(require, exports, module) {

'use strict';

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();
const { loadSubScript } = Cc['@mozilla.org/moz/jssubscript-loader;1'].
                     getService(Ci.mozIJSSubScriptLoader);
const { notifyObservers } = Cc['@mozilla.org/observer-service;1'].
                        getService(Ci.nsIObserverService);

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

// Returns map of given `object`-s own property descriptors.
function getOwnPropertiesDescriptor(object) {
  let descriptor = {};
  getOwnPropertyNames(object).forEach(function(name) {
    descriptor[name] = getOwnPropertyDescriptor(object, name)
  });
  return descriptor;
}

// Freeze important built-ins so they can't be used by untrusted code as a
// message passing channel.
freeze(Object);
freeze(Object.prototype);
freeze(Function);
freeze(Function.prototype);
freeze(Array);
freeze(Array.prototype);

// This function takes `f` function and optional `prototype` that is set as
// `f.prototype`. If `prototype` is not passed then `undefined` is used. Both
// `prototype` and `f` gets frozen and `f` is returned back. We need to do
// this kind of deep freeze with all the exposed functions so that untrusted
// code won't be able to use functions or their prototypes as a message channel.
function iced(f) {
  f.prototype = undefined;
  return freeze(f);
}

// Defines own properties of given `properties` object on the given
// target object overriding any existing property with a conflicting name.
// Returns `target` object. Note we only export this function because it's
// useful during loader bootstrap when other util modules can't be used &
// thats only case where this export should be used.
const override = iced(function override(target, properties) {
  return defineProperties(target, getOwnPropertiesDescriptor(properties));
});
exports.override = override;

// Function takes set of options and returns a JS sandbox. Function may be
// passed set of options:
//  - `name`: A string value which identifies the sandbox in about:memory. Will
//    throw exception if omitted.
// - `principal`: String URI or `nsIPrincipal` for the sandbox. Defaults to
//    system principal.
// - `prototype`: Ancestor for the sandbox that will be created. Defaults to
//    `{}`.
// - `wantXrays`: A Boolean value indicating whether code outside the sandbox
//    wants X-ray vision with respect to objects inside the sandbox. Defaults
//    to `true`.
// - `sandbox`: A sandbox to share JS compartment with. If omitted new
//    compartment will be created.
// For more details see:
// https://developer.mozilla.org/en/Components.utils.Sandbox
const Sandbox = iced(function Sandbox(options) {
  // Normalize options and rename to match `Cu.Sandbox` expectations.
  options = {
    sandboxName: options.name,
    principal: 'principal' in options ? options.principal : systemPrincipal,
    wantXrays: 'wantXrays' in options ? options.wantXrays : true,
    sandboxPrototype: 'prototype' in options ? options.prototype : {},
    sameGroupAs: 'sandbox' in options ? options.sandbox : null
  };

  // Make `options.sameGroupAs` only if `sandbox` property is passed,
  // otherwise `Cu.Sandbox` will throw.
  if (!options.sameGroupAs)
    delete options.sameGroupAs;

  return Cu.Sandbox(options.principal, options);
});
exports.Sandbox = Sandbox;

// Evaluates code from the given `uri` into given `sandbox`. If
// `options.source` is passed, then that code is evaluated instead.
// Optionally following options may be given:
// - `options.encoding`: Source encoding, defaults to 'UTF-8'.
// - `options.line`: Line number to start count from for stack traces.
//    Defaults to 1.
// - `options.version`: Version of JS used, defaults to '1.8'.
const evaluate = iced(function evaluate(sandbox, uri, options) {
  let { source, line, version, encoding } = override({
    encoding: 'UTF-8',
    line: 1,
    version: '1.8',
    source: null
  }, options || {});

  return source ? Cu.evalInSandbox(source, sandbox, version, uri, line)
                : loadSubScript(uri, sandbox, encoding);
});
exports.evaluate = evaluate;

// Populates `exports` of the given CommonJS `module` object, in the context
// of the given `loader` by evaluating code associated with it.
const load = iced(function load(loader, module) {
  let { sandboxes, globals } = loader;
  let require = Require(loader, module);

  let sandbox = sandboxes[module.uri] = Sandbox({
    name: module.uri,
    // Get an existing module sandbox, if any, so we can reuse its compartment
    // when creating the new one to reduce memory consumption.
    sandbox: sandboxes[Object.keys(sandboxes).shift()],
    // We use `loader.globals` as prototype for the sandbox to provide module
    // with globals defined by a loader.
    prototype: globals,
    wantXrays: false
  });

  // Each sandbox at creation gets set of own properties that may be shadowing
  // ones defined by loader `globals` (For example `dump`). We override
  // `sandbox` properties with globals to make sure they aren't shadowed. Also,
  // not that we still need to use `globals` as prototype for sandboxes as some
  // globals maybe defined after loader is created and they should be accessible
  // by all modules.
  override(sandbox, globals);
  // Finally we expose set of properties defined by `CommonJS` specification.
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

// Utility function to check if id is relative.
function isRelative(id) { return id[0] === '.'; }
// Utility function to normalize module `uri`s so they have `.js` extension.
function normalize(uri) { return uri.substr(-3) === '.js' ? uri : uri + '.js'; }
// Utility function to join paths.
const resolve = iced(function resolve(id, base) {
  var path, paths, last
  paths = id.split('/')
  base = base ? base.split('/') : [ '.' ]
  if (base.length > 1)
    base.pop()
  while ((path = paths.shift())) {
    if (path === '..') {
      if (base.length && base[base.length - 1] !== '..') {
        if (base.pop() === '.')
          base.push(path)
      }
      else {
        base.push(path)
      }
    }
    else if (path !== '.') {
      base.push(path)
    }
  }
  if (base[base.length - 1].substr(-1) === '.')
    base.push('')
  return base.join('/')
});
exports.resolve = resolve;

// Built-in resolver function resolves module `id` to it's `requirer.uri` if
// it's relative, otherwise resolves it to `baseURI`.
const resolveID = iced(function resolveID(id, requirer, baseURI) {
  return resolve(normalize(id), isRelative(id) ? requirer.uri : baseURI);
});
exports.resolveID = resolveID;

// Creates version of `require` that will be exposed to the given `module`
// in the context of the given `loader`. Each module gets own limited copy
// of `require` that is allowed to load only a modules that are associated
// with it during link time.
const Require = iced(function Require(loader, requirer) {
  let { baseURI, modules, resolve } = loader;

  return iced(override(function require(id) {
    if (!id) // Throw if `id` is not passed.
      throw Error('you must provide a module name when calling require() from '
                  + requirer.id, requirer.uri);

    // Resolves `uri` of module using loaders resolver function.
    let uri = resolve(id, requirer, baseURI);

    if (uri === null) // Throw if `uri` can not be resolved.
      throw Error('Module: Can not resolve "' + id + '" module required by ' +
                  requirer.id + ' located at ' + requirer.uri, requirer.uri);

    let module = null;
    // If module is already cached by loader then just use it.
    if (uri in modules) {
      module = modules[uri];
    }
    // Otherwise load and cache it. We also freeze module to prevent surprises.
    else {
      module = modules[uri] = Module(id, uri);
      freeze(load(loader, module));
    }

    return module.exports;
  }, { main: loader.main })); // `require.main` is main `module`.
});
exports.Require = Require;

// Makes module object that is made available to CommonJS modules when they
// are evaluated, along with `exports` and `require`.
const Module = iced(function Module(id, uri) {
  return create(null, {
    id: { enumerable: true, value: id },
    exports: { enumerable: true, writable: true, value: create(null) },
    uri: { value: uri }
  });
});
exports.Module = Module;

// Takes `loader`, and unload `reason` string and notifies all observers that
// they should cleanup after them-self.
const unload = iced(function unload(loader, reason) {
  // subject is a unique object created per loader instance.
  // This allows any code to cleanup on loader unload regardless of how
  // it was loaded. To handle unload for specific loader subject may be
  // asserted against loader.destructor or require('@packaging').destructor.
  let subject = { wrappedJSObject: loader.destructor };
  notifyObservers(subject, 'sdk:loader:destroy', reason);
});
exports.unload = unload;

// Function makes new loader that can be used to load CommonJS modules
// described by a given `options.manifest`. Loader takes following options:
// - `manifest`: Map describing module dependency graph that created loader
//   will follow. This is required property.
// - `id`: Unique identifier string for the created loader instance. On loader
//   unload observer service notification for `'sdk:destroy:loader:' + id` will
//   be dispatched (required).
// - `mainID`: Id of the main module (required).
// - `mainPath`: Path of the main module (required).
// - `globals`: Optional map of globals, that all module scopes will inherit
//   from. Map is also exposed under `globals` property of the returned loader
//   so it can be extended further later. Defaults to `{}`.
// - `modules` Optional map of modules that will be used by this loader as
//   a module cache. This is also exposed as `modules` property of the returned
//   loader. Defaults to `{}`.
const Loader = iced(function Loader(options) {
  let { main, baseURI, modules, globals, resolve } = override({
    main: {},
    modules: {},
    globals: {},
    baseURI: 'resource:///modules/',
    resolve: resolveID,
  }, options);

  // We create an identity object that will be dispatched on an unload
  // event as subject. This way unload listeners will be able to assert
  // which loader is unloaded.
  let destructor = freeze(create(null));

  // Define pseudo modules.
  modules = override({
    '@packaging': override(JSON.parse(JSON.stringify(options)), {
      destructor: destructor
    }),
    'chrome': { Cc: Cc, CC: CC, Ci: Ci, Cu: Cu, Cr: Cr, Cm: Cm,
                components: Components }
  }, modules);

  modules = Object.keys(modules).reduce(function(result, id) {
    // We resolve `uri` from `id` since modules are cached by `uri`.
    let module = Module(id, resolve(id, { uri: '' }, baseURI));
    module.exports = freeze(modules[id]);
    result[module.uri] = freeze(module);
    return result;
  }, {});

  // Create main module entry.
  modules[main.uri] = Module(main.id, main.uri);

  return freeze({
    main: modules[main.uri],
    destructor: destructor,
    baseURI: baseURI,
    resolve: resolve,
    modules: modules,
    globals: globals,
    sandboxes: {}           // Map of module sandboxes.
  });
});
exports.Loader = Loader;

});
