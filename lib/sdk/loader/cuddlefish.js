/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

module.metadata = {
  "stability": "unstable"
};

// This module is manually loaded by bootstrap.js in a sandbox and immediatly
// put in module cache so that it is never loaded in any other way.

/* Workarounds to include dependencies in the manifest
require('chrome')                  // Otherwise CFX will complain about Components
require('toolkit/loader')          // Otherwise CFX will stip out loader.js
require('sdk/addon/runner')        // Otherwise CFX will stip out addon/runner.js
*/

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu } = Components;

// `loadSandbox` is exposed by bootstrap.js
const loaderURI = module.uri.replace("sdk/loader/cuddlefish.js",
                                     "toolkit/loader.js");
// We need to keep a reference to the sandbox in order to unload it in
// bootstrap.js
const loaderSandbox = loadSandbox(loaderURI);
const loaderModule = loaderSandbox.exports;

const { override } = loaderModule;

function CuddlefishLoader(options) {
  let { manifest } = options;

  options = override(options, {
    // Put `api-utils/loader` and `api-utils/cuddlefish` loaded as JSM to module
    // cache to avoid subsequent loads via `require`.
    modules: override({
      'toolkit/loader': loaderModule,
      'addon-sdk/sdk/loader/cuddlefish': exports
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

  let loader = loaderModule.Loader(options);
  // Hack to allow loading from `toolkit/loader`.
  loader.modules[loaderURI] = loaderSandbox;
  return loader;
}

exports = override(loaderModule, {
  Loader: CuddlefishLoader
});
