"use strict";

const { Loader: { Loader, Require, Module, main } } = Components.utils.import("resource://gre/modules/commonjs/toolkit/loader.js", {});

const loader = Loader({
  id: "toolkit/require",
  rootURI: "",
  isNative: true,
  paths: {
   "": "resource://gre/modules/commonjs/",
   "devtools/": "resource://gre/modules/devtools/"
  }
});

// Below we define `require` & `require.resolve` that resolve passed
// module id relative to the caller URI. This is not perfect but good
// enough for common case & there is always an option to pass absolute
// id when that
// but presumably well enough to cover

const require = id => {
  const requirerURI = Components.stack.caller.filename;
  const requirer = Module(requirerURI, requirerURI);
  return Require(loader, requirer)(id);
};

require.resolve = id => {
  const requirerURI = Components.stack.caller.filename;
  const requirer = Module(requirerURI, requirerURI);
  return Require(loader, requirer).resolve(id);
};

const EXPORTED_SYMBOLS = ["require"];
