"use strict";

const { Loader } = require("@loader");

exports.Loader = function(module, globals) {
  var options = JSON.parse(JSON.stringify(require("@packaging")));
  options.globals = globals;
  let loader = Loader.new(options);
  return Object.create(loader, {
    require: { value: Loader.require.bind(loader, module.uri) },
    sandbox: { value: function sandbox(id) {
      let uri = options.manifest[module.uri].requirements[id].uri;
      return loader.sandboxes[uri].sandbox;
    }},
    unload: { value: function unload(reason, callback) {
      loader.unload(reason, callback);
    }}
  })
};
