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
let cuddlefishURI = null;

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
  try {
    let reason = REASON[reasonCode];
    // URI for the root of the XPI file.
    // 'jar:' URI if the addon is packed, 'file:' URI otherwise.
    // (Used by l10n module in order to fetch `locale` folder)
    let rootURI = data.resourceURI.spec;

    // TODO: Maybe we should perform read harness-options.json asynchronously,
    // since we can't do anything until 'sessionstore-windows-restored' anyway.
    let options = JSON.parse(readURI(rootURI + './harness-options.json'));

    let id = options.jetpackID;
    // Register a new resource 'domain' for this addon which is mapping to
    // XPI's `resources` folder.
    // Generate the domain name by using jetpack ID, which is the extension ID
    // by stripping common characters that doesn't work as a domain name:
    let uuidRe =
      /^\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/;

    let domain = id.
      toLowerCase().
      replace(/@/g, '-at-').
      replace(/\./g, '-dot-').
      replace(uuidRe, '$1');

    let prefixURI = 'resource://' + domain + '/';
    let resourcesURI = ioService.newURI(rootURI + '/resources/', null, null);
    resourceHandler.setSubstitution(domain, resourcesURI);

    // We use global `loaderURI` to allow unload.
    cuddlefishURI = prefixURI + options.loader;

    // Import `cuddlefish.js` module using `Cu.import` and bootstrap loader.
    let cuddlefish = Cu.import(cuddlefishURI);
    unload = cuddlefish.unload;
    loader = cuddlefish.Loader({
      // Add-on ID used by different APIs as a unique identifier.
      id: id,
      // Add-on name.
      name: options.name,
      // Add-on version.
      version: options.metadata[options.name].version,
      // Add-on package descriptor.
      metadata: options.metadata[options.name],
      // Main id and URI.
      main: { id: options.main, uri: prefixURI + options.mainPath },
      // Add-on load reason.
      loadReason: reason,

      // Add-on URI.
      rootURI: rootURI,
      prefixURI: prefixURI,
      baseURI: 'resource:///modules/',

      // modules manifest
      manifest: options.manifest,

      // options used by system module.
      // File to write 'OK' or 'FAIL' (exit code emulation).
      resultFile: options.resultFile,
      // File to write stdout.
      logFile: options.logFile,
      // Arguments passed as --static-args
      staticArgs: options.staticArgs,

      // Arguments related to test runner.
      modules: {
        '@test/options': {
          allTestModules: options.allTestModules,
          iterations: options.iterations,
          filter: options.filter,
          profileMemory: options.profileMemory,
          stopOnError: options.stopOnError,
          verbose: options.verbose,
        }
      }
    });

    let module = cuddlefish.Module('api-utils/cuddlefish', cuddlefishURI);
    let require = Require(loader, module);
    require('api-utils/addon/runner').startup(reason, {
      loader: loader,
      prefsURI: rootURI + 'defaults/preferences/prefs.js'
    });
  } catch (error) {
    dump('Error: ' + error.message + '\n' + (error.stack || error.fileName +
         ': ' + error.lineNumber) + '\n');
  }
};

function shutdown(data, reasonCode) {
  let reason = REASON[reasonCode];
  if (loader) {
    unload(loader, reason);
    // Bug 724433: We need to unload JSM otherwise it will stay alive
    // and keep a reference to this compartment.
    Cu.unload(cuddlefishURI);
    loader = unload = null;
  }
};
