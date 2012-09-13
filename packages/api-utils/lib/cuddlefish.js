/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
;(function(id, factory) { // Module boilerplate :(
  if (typeof(define) === 'function') { // RequireJS
    define(factory);
  } else if (typeof(require) === 'function') { // CommonJS
    factory.call(this, require, exports, module);
  } else if (~String(this).indexOf('BackstagePass')) { // JSM
    factory(function require(uri) {
      var imports = {};
      this['Components'].utils.import(uri, imports);
      return imports;
    }, this, { uri: __URI__, id: id });
    this.EXPORTED_SYMBOLS = Object.keys(this);
  } else {  // Browser or alike
    var globals = this
    factory(function require(id) {
      return globals[id];
    }, (globals[id] = {}), { uri: document.location.href + '#' + id, id: id });
  }
}).call(this, 'loader', function(require, exports, module) {

'use strict';

module.metadata = {
  "stability": "unstable"
};

/* Workarounds to include dependencies in the manifest
require('chrome')                 // Otherwise CFX will complain about Components
require('api-utils/loader')       // Otherwise CFX will stip out loader.js
require('api-utils/addon/runner') // Otherwise CFX will stip out addon/runner.js
*/

// Note require here in this context is just an alias for Cu.import which is
// used since regular require is not available at loader bootstrap.
const loaderURI = module.uri.replace(/\/[^\/]*$/, '/loader.js');
const loaderModule = require(loaderURI);
const { Loader: BaseLoader, Require, Sandbox, resolveURI, evaluate, load,
        Module, unload, override, descriptor, main } = loaderModule;

exports.resolveURI = resolveURI;
exports.Require = Require;
exports.Sandbox = Sandbox;
exports.evaluate = evaluate;
exports.load = load;
exports.Module = Module;
exports.unload = unload;
exports.override = override;
exports.descriptor = descriptor;
exports.main = main;

function Loader(options) {
  let { manifest } = options;

  options = override(options, {
    // Put `api-utils/loader` and `api-utils/cuddlefish` loaded as JSM to module
    // cache to avoid subsequent loads via `require`.
    modules: override({
      'api-utils/loader': loaderModule,
      'api-utils/cuddlefish': exports
    }, options.modules),
    resolve: function resolve(id, requirer) {
      let entry = requirer && requirer in manifest && manifest[requirer];
      let uri = null;

      // If manifest entry for this requirement is present we follow manifest.
      // Note: Standard library modules like 'panel' will be present in
      // manifest unless they were moved to platform.
      if (entry) {
        let requirement = entry.requirements[id];
        // If requirer entry is in manifest and it's requirement is not, than
        // it has no authority to load since linker was not able to find it.
        if (!requirement)
          throw Error('Module: ' + requirer.id + ' located at ' + requirer.uri
                      + ' has no authority to load: ' + id, requirer.uri);

        uri = requirement;
      }
      // If requirer is off manifest than it's a system module and we allow it
      // to go off manifest.
      else {
        uri = id;
      }
      return uri;
    }
  });

  return BaseLoader(options);
}
Loader.prototype = null;
exports.Loader = Object.freeze(Loader);

});
