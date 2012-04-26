/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @see http://mxr.mozilla.org/mozilla-central/source/js/src/xpconnect/loader/mozJSComponentLoader.cpp

'use strict';

// IMPORTANT: Avoid adding any initialization tasks here, if you need to do
// something before add-on is loaded consider addon/runner module instead!

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;
const ioService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const resourceHandler = ioService.getProtocolHandler('resource').
                        QueryInterface(Ci.nsIResProtocolHandler);
const REASON = [ 'unknown', 'startup', 'shutdown', 'enable', 'disable',
                 'install', 'uninstall', 'upgrade', 'downgrade' ];

let loader = null;
let unload = null;
let loaderURI = null;

const URI = __SCRIPT_URI_SPEC__.replace(/bootstrap\.js$/, '');

// Utility function that synchronously reads local resource from the given
// `uri` and returns content string.
function readURI(uri) {
  let ioservice = Cc['@mozilla.org/network/io-service;1'].
    getService(Ci.nsIIOService);
  let channel = ioservice.newChannel(uri, 'UTF-8', null);
  let stream = channel.open();

  let cstream = Cc['@mozilla.org/intl/converter-input-stream;1'].
    createInstance(Ci.nsIConverterInputStream);
  cstream.init(stream, 'UTF-8', 0, 0);

  let str = {};
  let data = '';
  let read = 0;
  do {
    read = cstream.readString(0xffffffff, str);
    data += str.value;
  } while (read != 0);

  cstream.close();

  return data;
}


// We don't do anything on install & uninstall yet, but in a future
// we should allow add-ons to cleanup after uninstall.
function install(data, reason) {}
function uninstall(data, reason) {}

function startup(data, reasonCode) {
  let reason = REASON[reasonCode];
  // TODO: Maybe we should perform read harness-options.json asynchronously,
  // since we can't do anything until 'sessionstore-windows-restored' anyway.
  let options = JSON.parse(readURI(URI + './harness-options.json'));
  options.loadReason = reason;

  // URI for the root of the XPI file.
  // 'jar:' URI if the addon is packed, 'file:' URI otherwise.
  // (Used by l10n module in order to fetch `locale` folder)
  options.rootURI = data.resourceURI.spec;

  // Register a new resource 'domain' for this addon which is mapping to
  // XPI's `resources` folder.
  // Generate the domain name by using jetpack ID, which is the extension ID
  // by stripping common characters that doesn't work as a domain name:
  let uuidRe =
    /^\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/;
  let domain = options.
    jetpackID.toLowerCase().
    replace(/@/g, '-at-').
    replace(/\./g, '-dot-').
    replace(uuidRe, '$1');

  let resourcesURI = ioService.newURI(URI + '/resources/', null, null);
  let prefixURI = 'resource://' + domain + '/';
  loaderURI = prefixURI + options.loader;

  resourceHandler.setSubstitution(domain, resourcesURI);

  options.prefsURI = URI + 'defaults/preferences/prefs.js';
  options.prefixURI = prefixURI;
  options.main = { id: options.main, uri: prefixURI + options.mainPath };
  options.id = options.jetpackID;
  options.loaderURI = loaderURI;

  // Adding `uriPrefix` for backwards compatibility.
  options.uriPrefix = prefixURI;

  // Import loader module using `Cu.import` and bootstrap module loader.
  try {
    let module = Cu.import(loaderURI);
    unload = module.unload;
    loader = module.Loader(options);
    let require = Require(loader, { uri: loaderURI });
    require('api-utils/addon/runner').startup(reason, { loader: loader });
  } catch (error) {
    dump('Error: ' + error.message + '\n' + (error.stack || error.fileName + ': ' + error.lineNumber) + '\n');
  }
};

function shutdown(data, reasonCode) {
  let reason = REASON[reasonCode];
  if (loader) {
    unload(loader, reason);
    // Bug 724433: We need to unload JSM otherwise it will stay alive
    // and keep a reference to this compartment.
    Cu.unload(loaderURI);
    loader = unload = null;
  }
};
