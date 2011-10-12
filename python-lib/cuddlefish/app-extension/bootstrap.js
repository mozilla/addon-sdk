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
const ioService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
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

const Sandbox = {
  new: function (prototype, principal) {
    return Object.create(Sandbox, {
      sandbox: {
        value: Cu.Sandbox(principal || Sandbox.principal, {
          sandboxPrototype: prototype || Sandbox.prototype,
          wantXrays: Sandbox.wantXrays
        })
      }
    })
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
};

const Loader = {
  new: function (options) {
    // TODO: Also adding legacy global that some code depends on, which should
    // migrate to require("packaging") or similar instead.
    let globals = {
      packaging: { jetpackID: options.jetpackID, options: options },
      dump: dump
    };

    let loader = Object.create(Loader, {
      globals: { value: globals },

      // Metadata from package.json.
      // Maybe this is obsolete.
      metadata: { value: options.metadata || {} },

      // Manifest generated by a linker, containing map of module url's mapped
      // to it's requirements.
      manifest: { value: options.manifest || {} },

      // TODO: Hack to allow module URI resolution from ID.
      // Hopefully we'll modify linker in a way that id's will map one on one
      // URIs.
      root: { value: options.uriPrefix },

      modules: { value: options.modules || Loader.modules },

      // If `true` sandboxes will be created per module, otherwise
      // one sandbox will be used for all modules.
      sandboxes: { value: options.sandboxes <= 1 ? Sandbox.new(globals) : {} }
    });

    loader.modules['@packaging.js'] = Object.freeze({
      id: '@packaging',
      exports: JSON.parse(JSON.stringify(options))
    });
    loader.modules['@loader.js'] = Object.freeze({
      exports: Object.freeze({ Loader: Loader }),
      id: '@loader'
    });

    // TODO: This is unnecessary overhead add-on already has resource URI which
    // we should use, it's just packages should be aligned so that they can map
    // easily to the module IDs.
    mapResources(options.uri, options.resources);

    // Loading globals for special module and put them into loader globals.
    globals = loader.require(null, 'api-utils/globals!');
    Object.keys(globals).forEach(function(name) {
      loader.globals[name] = globals[name];
    });

    return loader
  },
  modules: {
    'chrome.js': Object.freeze({
      exports: Object.freeze({
        Cc: Cc,
        CC: CC,
        Ci: Ci,
        Cu: Cu,
        Cr: Cr,
        Cm: Cm,
        components: Components,
        messageManager: 'addMessageListener' in exports ? exports : null
      }),
      id: 'chrome'
    }),
    'self.js': function self(loader, requirer) {
      return loader.require(null, 'api-utils/self!').create(requirer.uri);
    },
  },
  load: function load(uri, module) {
    // HACK: `dump` is overridden on windows for details see:
    // packages/api-utils/globals!.js
    let { dump } = this.globals;

    let source;
    try {
      source = readURI(uri);
    } catch(error) {
      throw new Error('Module: ' + module.id + ' was not found: ' + uri)
    }

    let sandbox = this.sandbox || (this.sandboxes[uri] = Sandbox.new(this.globals));
    let exports = module.exports;
    let require = this.require.bind(this, uri);
    require.main = this.main;
    try {
      let factory = sandbox.evaluate('(function(require, exports, module, dump) {' + source + ' })', uri);
      factory.call(exports, require, exports, module, dump);
    } catch(error) {
      dump(error.fileName + '#' + error.lineNumber + '\n')
      dump(error.message + '\n')
      dump(error.stack + '\n')
      throw error
    }

    return module.exports;
  },
  require: function require(base, id) {
    var uri, manifest = this.manifest[base], requirer = this.modules[base];
    // TODO: Remove debug log!
    // dump('>>>> ' + (requirer && requirer.id) + ' ? ' + id + '\n')
    // If we have a manifest for requirer, then all it's requirements have been
    // registered by linker.
    if (manifest) {
      // If required module is in manifest we use take resolved requirement
      // `id` from manifest.
      let requirement = manifest.requirements[id];
      if (requirement)
        uri = requirement.uri ? requirement.uri : normalize(id);

      // If module is known to have "sudo" privileges, we allow it to go
      // off-manifest. Otherwise we throw an error.
      else if (!('chrome' in manifest.requirements))
        throw new Error("Module: " + base && base.id +
                        " has no athority to load: " + id);
    } else {
      id = resolve(id, requirer && requirer.id);
      uri = normalize(resolveURI(this.root, id));
    }

    // TODO: Remove debug log!
    // dump('require: ' + id + '\n');

    let module = this.modules[uri] || (this.modules[uri] = {});
    // TODO: Find a better way to implement `self`.
    // Maybe something like require('self!path/to/data')
    if (typeof(module) === 'function')
      module = module(this, requirer);

    if (module.exports)
      return module.exports;

    module.id = id;
    module.uri = uri;
    module.main = this.main;
    module.exports = {};
    // TODO: I'd like to remove this, it's not used adds complexity and does
    // not has much adoption in commonjs either.
    module.setExports = function setExports(exports) {
      module.exports = exports;
    };

    // Loading required module and return it's exports.
    let exports = this.load(uri, module);

    // Workaround for bug 674195. Freezing objects from other sandboxes fail,
    // so we create decedent and freeze it instead.
    if (typeof(exports) === 'object') {
      exports = Object.prototype.isPrototypeOf(exports) ?
                Object.freeze(exports) :
                Object.freeze(Object.create(exports));
    }
    return exports;
  },
  main: function main(id) {
    // Overriding main so that all modules point to it.
    if (isRelative(id))
      id = resolve(id, this.require(null, '@packaging').name)
    this.main = this.modules[resolveURI(this.root, id)] = {};
    return this.require(null, id)
  },
  unload: function unload(reason, callback) {
    this.require(null, 'api-utils/unload').send(reason, callback);
  }
};
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
    let uri = Array.isArray(path) ? resolve('./' + path.join('/'), root)
                                  : 'file://' + path;
    uri = ioService.newURI(uri + '/', null, null);
    resourceHandler.setSubstitution(id, uri);
  });
}

exports.install = function install(data, reason) {
};

exports.uninstall = function uninstall(data, reason) {
};

exports.main = function main(options, id) {
  let loader = Loader.new(options);

  try {
    let main = loader.main(id);
    if (main.main)
      main.main();
  } catch (error) {
    loader.globals.console.exception(error);
  }
};

exports.startup = function startup(data, reason) {
  let uri = (data.resolveURI || resourceURI(data.installPath)).spec;
  let options = JSON.parse(readURI(resolve('./harness-options.json', uri)));
  // TODO: At the moment there are different ways 'main' can be specified:
  // 1. main            Guess.
  // 2. ./lib/main      Relative.
  // 3. package/module  Absolute.
  // It's tricky to guess which case is used here without runtime search. Would
  // be nice if we could just decide to support relative main as nodejs does or
  // make cfx do the search so that harness-options.json will contain relative
  // path. So far we assume that if `/` is present it's absolute.
  let mainID = ~options.main.indexOf('/') ?
               options.main : resolve('./' + options.main, options.name);
  options.uri = uri;

  let loader = exports.loader = Loader.new(options);

  // TODO: Also does not feels right to defer loading an add-on, but doing so
  // to match behavior of the legacy module loader.
  let observres = loader.require(null, 'api-utils/observer-service');
  observres.add('sessionstore-windows-restored', function onReady() {
    let process = loader.main('api-utils/process');
    // Spawning an add-on process for the main module.
    let addon = process.spawn(mainID);
    // Listen to `require!` channel's input messages from the add-on process
    // and load modules being required.
    addon.channel('require!').input(function(id) {
      try {
        loader.require(null, id).initialize(addon.channel(id));
      } catch (error) {
        loader.globals.console.exception(error);
      }
    });
  });
};

exports.shutdown = function shutdown(data, reason) {
  if (exports.loader) exports.loader.unload(reason)
};

}(typeof(exports) === 'undefined' ? this : exports);
