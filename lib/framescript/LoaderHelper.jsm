/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu, results: Cr, manager: Cm } = Components;
const { loadSubScript } = Cc['@mozilla.org/moz/jssubscript-loader;1'].getService(Ci.mozIJSSubScriptLoader);
const cpmm = Cc['@mozilla.org/childprocessmessagemanager;1'].getService(Ci.nsISyncMessageSender);
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();

// one Loader instance per addon (per @loader/options to be precise)
let addons = new Map();

cpmm.addMessageListener('sdk/loader/unload', ({ data: options }) => {
  let key = JSON.stringify(options);
  let a = addons.get(key);
  a && a.loader.unload();
  addons.delete(key);
})

// create a Loader instance from @loader/options
function loader(options) {
  let key = JSON.stringify(options);
  let addon = addons.get(key);
  if (addon)
    return addon;

  let id = 'toolkit/loader';
  let uri = options.paths[''] + id + '.js';

  let module = loadSandbox(uri).exports;
  options.modules[id] = module;
  options.modules["@test/options"] = {};
  delete options.globals;

  addon = { loader: module.Loader(options) };
  addon.require = module.Require(addon.loader, module.Module(id, uri));
  addons.set(key, addon);
  return addon;
}

// adapted from bootstrap.js
const loadSandbox = (uri) => {
  let proto = { sandboxPrototype: { loadSandbox, ChromeWorker: null }};
  let sandbox = Cu.Sandbox(systemPrincipal, proto);
  sandbox.exports = {};
  sandbox.module = { uri: uri, exports: sandbox.exports };
  sandbox.require = (id) => (id === "chrome") && Object.freeze({
    Cc, Ci, Cu, Cr, Cm, CC: bind(CC, Components), components: Components });
  loadSubScript(uri, sandbox, 'UTF-8');
  return sandbox;
}

const EXPORTED_SYMBOLS = ['loader'];
