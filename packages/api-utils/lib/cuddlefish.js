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
const ioService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const SYSTEM_ROOT = 'resource:///modules/'
const SYSTEM_DEFAULT = 'sdk'

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

// This function takes `f` function and optional `prototype` that is set as
// `f.prototype`. If `prototype` is not passed then `undefined` is used. Both
// `prototype` and `f` gets frozen and `f` is returned back. We need to do
// this kind of deep freeze with all the exposed functions so that untrusted
// code won't be able to use functions or their prototypes as a message channel.
function iced(f) {
  f.prototype = undefined;
  return freeze(f);
}

// Returns map of given `object`-s own property descriptors.
function getOwnPropertiesDescriptor(object) {
  let descriptor = {};
  getOwnPropertyNames(object).forEach(function(name) {
    descriptor[name] = getOwnPropertyDescriptor(object, name)
  });
  return descriptor;
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

// Freeze important built-ins so they can't be used by untrusted code as a
// message passing channel.
freeze(Object);
freeze(Object.prototype);
freeze(Function);
freeze(Function.prototype);
freeze(Array);
freeze(Array.prototype);

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
                : scriptLoader.loadSubScript(uri, sandbox, encoding);
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

function isRelative(id) { return id[0] === '.'; }
function isSystem(id) {
  return id[0] === '@' || id === 'chrome' || id === 'self';
}
function normalize(id) {
  // If module has a form like '@panel' it means '@sdk/panel', so we
  // normalize it.
  if (isSystem(id) && ~id.indexOf('/'))
    id = '@' + SYSTEM_DEFAULT + '/' + id.substr(1)
  // If module does not has file extension it's normalized to include one.
  if (id.substr(-3) !== '.js')
    id = id + '.js'

  return id
}

function resolveURI(uri, base) {
  return ioService.newURI(relative, null, ioService.newURI(base)).spec;
}

function Resolve({ prefixURI, modules }) {
  return iced(function resolve(id, requirer, manifest) {
    let uri = null;
    let path = requirer.uri.split(prefixURI).pop();
    let entry = path in manifest && manifest[path];

    let requirement = entry && entry.requirements[id];
    // If manifest entry for this requirement is present we follow manifest.
    // Note: Standard library modules like '@panel' will be present in manifest
    // unless they were moved to platform.
    if (requirement) {
      // If cached modules contains entry with that ID that's one of the
      // predefined modules like 'chrome', '@loader', ... so we just grab
      // from there.
      if (requirement.path in modules)
        uri = requirement.path;
      // Otherwise we get URI by resolving path to the `prefixURI`.
      else
        uri = prefixURI + requirement.path;
    }
    // If requirer is system module allow it to go off manifest.
    else if (isSystem(requirer.id)) {
      // If module is relative we resolve it the requirer
      if (isRelative(id))
        uri = resolveURI(normalize(id), requirer.uri);
      // If module is system one we resolve it to system modules root.
      else if (isSystem(id))
        uri = resolveURI(normalize(id).substr(1), SYSTEM_ROOT);
      else if (id in modules)
        uri = id
      // The only case left is external modules like `foo/bar` which do not
      // exists for system modules, so we can't resolve it. Note: require
      // will throw can't resolve if no URI is returned.
    }
    // If module entry is not in manifest and requirer is not a system module
    // than it has no authority to load since linker was not able to find it.
    else {
      throw Error('Module: ' + (requirer.id) + ' located at ' + requirer.uri +
                  ' has no authority to load: ' + id, requirer.uri);

    }

    return uri;
  })
}

// Creates version of `require` that will be exposed to the given `module`
// in the context of the given `loader`. Each module gets own limited copy
// of `require` that is allowed to load only a modules that are associated
// with it during link time.
const Require = iced(function Require(loader, requirer) {
  let { prefixURI, modules, manifest, resolve } = loader;

  return iced(override(function require(id) {
    if (!id)
      throw Error('you must provide a module name when calling require() from '
                  + requirer.id, requirer.uri);

    // Resolves `uri` of module using resolver function of a loader.
    let uri = resolve(id, requirer, manifest, prefixURI);

    // If `uri` was not resolved than requirer has no authority to load it so
    // we throw.
    if (uri === null)
      throw Error('Module: Can not resolve "' + id + '" module required by ' +
                  requirer.id + ' located at ' + requirer.uri, requirer.uri);

    let module = null;
    // If module was already loaded than it's cached by loader & we grab it.
    if (uri in modules) {
      module = modules[uri];
    }
    // If module is not in cache, we create it and then load it. Once loaded
    // we freeze to prevent further mutations.
    else {
      module = modules[uri] = Module(id, uri);
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
  }, { main: loader.main })); // `require.main` is main `module`.
});
exports.Require = Require;

// Makes module object that is made available to CommonJS modules when they
// are evaluated, along with `exports` and `require`.
const Module = iced(function Module(id, uri) {
  return create(Object.prototype, {
    id: { enumerable: true, value: id },
    exports: { enumerable: true, writable: true, value: create(null) },
    uri: { value: uri }
  });
});
exports.Module = Module;

// Takes `loader`, and unload `reason` string and notifies all observers that
// they should cleanup after them-self.
const unload = iced(function unload(loader, reason) {
  observerService.notifyObservers(null, loader.unloadTopic, reason);
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
// - `prefixURI`: Root URI for the modules. Module paths resolve to this URI
//    (required).
// - `globals`: Optional map of globals, that all module scopes will inherit
//   from. Map is also exposed under `globals` property of the returned loader
//   so it can be extended further later. Defaults to `{}`.
// - `modules` Optional map of modules that will be used by this loader as
//   a module cache. This is also exposed as `modules` property of the returned
//   loader. Defaults to `{}`.
const Loader = iced(function Loader(options) {
  let { main, prefixURI, manifest, modules, globals, resolve } = override({
    main: {},
    manifest: {},
    modules: Object.prototype,
    globals: {},
    print: dump,
    resolve: null,
  }, options);
  options.unloadTopic = 'sdk:destroy:loader:' + options.id;

  // Create a module cache.
  modules = create(modules);

  modules[main.uri] = Module(main.id, main.uri);

  let loader = freeze({
    main: modules[main.uri],
    resolve: resolve || Resolve({ prefixURI: prefixURI, modules: modules }),
    unloadTopic: options.unloadTopic,
    // Manifest generated by a linker, containing map of module url's mapped
    // to it's requirements, comes from harness-options.json
    manifest: manifest,
    modules: modules,
    globals: globals,
    prefixURI: prefixURI,
    sandboxes: {}           // Map of module sandboxes.
  });

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
      let require = Require(loader, { uri: loaderURI });
      return require('api-utils/self!').create(requirer);
    }
  });

  return loader;
});
exports.Loader = Loader;

});
