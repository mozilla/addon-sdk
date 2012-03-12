/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @see http://mxr.mozilla.org/mozilla-central/source/js/src/xpconnect/loader/mozJSComponentLoader.cpp

"use strict";

const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu,
        results: Cr, manager: Cm } = Components;
const ioService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const resourceHandler = ioService.getProtocolHandler('resource')
                        .QueryInterface(Ci.nsIResProtocolHandler);
const XMLHttpRequest = CC('@mozilla.org/xmlextras/xmlhttprequest;1',
                          'nsIXMLHttpRequest');
const prefs = Cc["@mozilla.org/preferences-service;1"].
              getService(Ci.nsIPrefService).
              QueryInterface(Ci.nsIPrefBranch2);
const mozIJSSubScriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"].
                            getService(Ci.mozIJSSubScriptLoader);

const REASON = [ 'unknown', 'startup', 'shutdown', 'enable', 'disable',
                 'install', 'uninstall', 'upgrade', 'downgrade' ];

let loader = null;
let loaderUri = null;

const URI = __SCRIPT_URI_SPEC__.replace(/bootstrap\.js$/, "");

// Initializes default preferences
function setDefaultPrefs() {
  let branch = prefs.getDefaultBranch("");
  let prefLoaderScope = {
    pref: function(key, val) {
      switch (typeof val) {
        case "boolean":
          branch.setBoolPref(key, val);
          break;
        case "number":
          if (val % 1 == 0) // number must be a integer, otherwise ignore it
            branch.setIntPref(key, val);
          break;
        case "string":
          branch.setCharPref(key, val);
          break;
      }
    }
  };

  let uri = ioService.newURI(
      "defaults/preferences/prefs.js",
      null,
      ioService.newURI(URI, null, null));

  // if there is a prefs.js file, then import the default prefs
  try {
    // setup default prefs
    mozIJSSubScriptLoader.loadSubScript(uri.spec, prefLoaderScope);
  }
  // errors here should not kill addon
  catch (e) {
    Cu.reportError(e);
  }
}

// Gets the topic that fit best as application startup event, in according with
// the current application (e.g. Firefox, Fennec, Thunderbird...)
function getAppStartupTopic() {
  // The following mapping of application names to GUIDs was taken
  // from `xul-app` module. They should keep in sync, so if you change one,
  // change the other too!
  let ids = {
    Firefox: '{ec8030f7-c20a-464f-9b0e-13a3a9e97384}',
    Mozilla: '{86c18b42-e466-45a9-ae7a-9b95ba6f5640}',
    Sunbird: '{718e30fb-e89b-41dd-9da7-e25a45638b28}',
    SeaMonkey: '{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}',
    Fennec: '{aa3c5121-dab2-40e2-81ca-7ea25febc110}',
    Thunderbird: '{3550f703-e582-4d05-9a08-453d09bdfdc6}'
  };

  let id = Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULAppInfo).ID;

  switch (id) {
    case ids.Firefox:
    case ids.SeaMonkey:
      return 'sessionstore-windows-restored';
    case ids.Thunderbird:
      return 'mail-startup-done';
    // Temporary, until Fennec Birch will support sessionstore event
    case ids.Fennec:
    default:
      return 'final-ui-startup';
  }
}

// Utility function that synchronously reads local resource from the given
// `uri` and returns content string.
function readURI(uri) {
  let ioservice = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  let channel = ioservice.newChannel(uri, "UTF-8", null);
  let stream = channel.open();

  let cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);  
  cstream.init(stream, "UTF-8", 0, 0);

  let str = {};
  let data = "";
  let read = 0;
  do {
    read = cstream.readString(0xffffffff, str);
    data += str.value;
  } while (read != 0);

  cstream.close();

  return data;
}

// Function takes `topic` to be observer via `nsIObserverService` and returns
// promise that will be delivered once notification is published.
function on(topic) {
  return function promise(deliver) {
    const observerService = Cc['@mozilla.org/observer-service;1'].
                            getService(Ci.nsIObserverService);

    observerService.addObserver({
      observe: function observer(subject, topic, data) {
        observerService.removeObserver(this, topic);
        deliver(subject, topic, data);
      }
    }, topic, false);
  }
}

// We don't do anything on install & uninstall yet, but in a future
// we should allow add-ons to cleanup after uninstall.
function install(data, reason) {}
function uninstall(data, reason) {}

function startup(data, reason) {
  // TODO: When bug 564675 is implemented this will no longer be needed
  // Always set the default prefs, because they disappear on restart
  setDefaultPrefs();

  // TODO: Maybe we should perform read harness-options.json asynchronously,
  // since we can't do anything until 'sessionstore-windows-restored' anyway.
  let options = JSON.parse(readURI(URI + './harness-options.json'));
  options.loadReason = REASON[reason];

  // URI for the root of the XPI file.
  // 'jar:' URI if the addon is packed, 'file:' URI otherwise.
  // (Used by l10n module in order to fetch `locale` folder)
  options.rootURI = data.resourceURI.spec;

  // Register a new resource "domain" for this addon which is mapping to
  // XPI's `resources` folder.
  // Generate the domain name by using jetpack ID, which is the extension ID
  // by stripping common characters that doesn't work as a domain name:
  let uuidRe =
    /^\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/;
  let domain = options.jetpackID.toLowerCase()
                            .replace(/@/g, "-at-")
                            .replace(/\./g, "-dot-")
                            .replace(uuidRe, "$1");

  let resourcesUri = ioService.newURI(URI + '/resources/', null, null);
  resourceHandler.setSubstitution(domain, resourcesUri);
  options.uriPrefix = "resource://" + domain + "/";

  // Import loader module using `Cu.imports` and bootstrap module loader.
  loaderUri = options.uriPrefix + options.loader;
  loader = Cu.import(loaderUri).Loader.new(options);

  // Creating a promise, that will be delivered once application is ready.
  // If application is at startup then promise is delivered on
  // the application startup topic, otherwise it's delivered immediately.
  let promise = reason === APP_STARTUP ? on(getAppStartupTopic()) :
                                         function promise(deliver) deliver()

  // Once application is ready we spawn a new process with main module of
  // on add-on.
  promise(function() {
    try {
      loader.spawn(options.main, options.mainPath);
    } catch (error) {
      // If at this stage we have an error only thing we can do is report about
      // it via error console. Keep in mind that error won't automatically show
      // up there when called via observerService.
      Cu.reportError(error);
      throw error;
    }
  });

};

function shutdown(data, reason) {
  // If loader is already present unload it, since add-on is disabled.
  if (loader) {
    reason = REASON[reason];
    let system = loader.require('api-utils/system');
    loader.unload(reason);

    // Bug 724433: We need to unload JSM otherwise it will stay alive
    // and keep a reference to this compartment.
    Cu.unload(loaderUri);
    loader = null;

    // If add-on is lunched via `cfx run` we need to use `system.exit` to let
    // cfx know we're done (`cfx test` will take care of exit so we don't do
    // anything here).
    if (system.env.CFX_COMMAND === 'run' && reason === 'shutdown')
      system.exit(0);
  }
};
