/* vim:set ts=2 sw=2 sts=2 expandtab */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
 *  Matteo Ferretti <zer0@mozilla.com>
 *  Erik Vold <erikvvold@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
    Fennec: '{a23983c0-fd0e-11dc-95ff-0800200c9a66}',
    Thunderbird: '{3550f703-e582-4d05-9a08-453d09bdfdc6}'
  };

  let id = Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULAppInfo).ID;

  switch (id) {
    case ids.Firefox:
    case ids.Fennec:
    case ids.SeaMonkey:
      return 'sessionstore-windows-restored';
    case ids.Thunderbird:
      return 'mail-startup-done';
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

  // Register a new resource "domain" for this addon which is mapping to
  // XPI's `resources` folder.
  let resourcesUri = ioService.newURI(URI + '/resources/', null, null);
  resourceHandler.setSubstitution(options.unique_prefix, resourcesUri);
  options.uriPrefix = "resource://" + options.unique_prefix + "/";

  // Import loader module using `Cu.imports` and bootstrap module loader.
  let loaderUri = options.uriPrefix + options.loader;
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
    // If add-on is lunched via `cfx run` we need to use `system.exit` to let
    // cfx know we're done (`cfx test` will take care of exit so we don't do
    // anything here).
    if (system.env.CFX_COMMAND === 'run' && reason === 'shutdown')
      system.exit(0);
  }
};
