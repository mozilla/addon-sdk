/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader, Require, unload, override } = require('api-utils/cuddlefish');

exports.Loader = function(module, globals, packaging) {
  let options = override({}, packaging || require("@loader-options"));
  let prefixURI = options.prefixURI;
  globals = override(override({}, require('api-utils/globals!')), globals || {});
  override(options, { globals: globals });

  let loader = Loader(options);
  return override(Object.create(loader), {
    require: Require(loader, module),
    sandbox: function(id) {
      let requirerPath = module.uri.split(prefixURI).pop();
      let path = options.manifest[requirerPath].requirements[id].path;
      return loader.sandboxes[options.prefixURI + path];
    },
    unload: function(reason) {
      unload(loader, reason);
    }
  });
};
