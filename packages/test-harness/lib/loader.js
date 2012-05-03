/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader, Require, unload, override } = require('@loader');

exports.Loader = function(module, globals, packaging) {
  var options = packaging || JSON.parse(JSON.stringify(require("@packaging")));
  var prefixURI = options.prefixURI;
  // Generate random ID for the loader unloads.
  options.id = Math.random().toString(36).slice(2);
  options.globals = globals || {
    console: console,
    dump: dump
  };

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
