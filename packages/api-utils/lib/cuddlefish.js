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

/* Workarounds to include dependencies in the manifest
require('chrome')                 // Otherwise CFX will complain about Components
require('api-utils/loader')       // Otherwise CFX will stip out loader.js
require('api-utils/addon/runner') // Otherwise CFX will stip out addon/runner.js
*/

// Load using import as at this point we don't have require.
const loaderURI = module.uri.replace(/\/[^\/]*$/, '/loader.js');
const loaderModule = Components.utils.import(loaderURI);
const { Loader: BaseLoader, Require, Sandbox, resolveID, evaluate, load,
        Module, unload, override } = loaderModule;

exports.resolveID = resolveID;
exports.Require = Require;
exports.Sandbox = Sandbox;
exports.evaluate = evaluate;
exports.load = load;
exports.Module = Module;
exports.unload = unload;
exports.override = override;

// Returns true if module id is 'chrome' or contains `@` character.
function isPseudo(id) { return id === 'chrome' || ~id.indexOf('@'); }

function Loader(options) {
  let { prefixURI, manifest } = options;
  options = override(override({}, options), {
    resolve: function resolve(id, requirer, baseURI) {
      let requirerPath = requirer.uri.split(prefixURI).pop();
      let entry = requirerPath in manifest && manifest[requirerPath];
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

        let path = requirement.path;
        // If this is a pseudo module we resolve it to `baseURI`
        uri = isPseudo(path) ? resolveID(path, requirer, baseURI) :
              // Otherwise we just prefix it with `prefixURI`.
              prefixURI + path;
      }
      // If requirer is off manifest than it's a system module and we allow it
      // to go off manifest.
      else {
        uri = resolveID(id, requirer, baseURI);
      }

      return uri;
    }
  });

  let loader = BaseLoader(options);

  // Put `api-utils/loader` and `api-utils/cuddlefish` loaded as JSM to module
  // cache to avoid subsequent loads via `require`.
  loader.modules[loaderURI] = {
    id: 'api-utils/loader',
    uri: loaderURI,
    exports: loaderModule
  };
  loader.modules[module.uri] = {
    id: 'api-utils/cuddlefish',
    uri: module.uri,
    exports: exports
  };

  return loader;
}
Loader.prototype = null;
exports.Loader = Object.freeze(Loader);

});
