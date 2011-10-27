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

const REASON = [ 'unknown', 'startup', 'shutdown', 'enable', 'disable',
                 'install', 'uninstall', 'upgrade', 'downgrade' ];

let loader = null;

// Utility function that synchronously reads local resource from the given
// `uri` and returns content string.
function readURI(uri) {
  let request = XMLHttpRequest();
  request.open('GET', uri, false);
  request.overrideMimeType('text/plain');
  request.send();
  return request.responseText;
}

// Shim function to get `resourceURI` in pre Gecko 7.0.
// https://developer.mozilla.org/en/Extensions/Bootstrapped_extensions#Bootstrap_data
function resourceURI(file) {
  // First creating "file:" URI.
  let uri = ioService.newFileURI(file);
  if (uri.spec.substr(-4) === '.xpi') // `unpack` is `false`
    uri = ioService.newURI('jar:' + uri.spec + '!/', null, null);

  return uri;
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

/**
 * Maps each path - value from `resources` hash in the resources protocol
 * handler with an associated key. Each path is resolved relative to the given
 * `root` path.
 */
function mapResources(root, resources) {
  Object.keys(resources).forEach(function(id) {
    let path = resources[id];
    let uri = Array.isArray(path) ? root + '/' + path.join('/')
                                  : 'file://' + path;
    uri = ioService.newURI(uri + '/', null, null);
    resourceHandler.setSubstitution(id, uri);
  });
}

// We don't do anything on install & uninstall yet, but in a future
// we should allow add-ons to cleanup after uninstall.
function install(data, reason) {}
function uninstall(data, reason) {}

function startup(data, reason) {
  let uri = (data.resourceURI || resourceURI(data.installPath)).spec;
  // TODO: Maybe we should perform read harness-options.json asynchronously,
  // since we can't do anything until 'sessionstore-windows-restored' anyway.
  let options = JSON.parse(readURI(uri + './harness-options.json'));
  options.loadReason = REASON[reason];

  // TODO: This is unnecessary overhead per add-on instance. Manifest should
  // probably contain paths relative to add-on root to avoid this, but that
  // requires simpler package layout that is being worked under the bug-660629.
  mapResources(uri, options.resources);

  // Import loader module using `Cu.imports` and bootstrap module loader.
  loader = Cu.import(options.loader).Loader.new(options);

  // Creating a promise, that will be delivered once application is ready.
  // If application is at startup then promise is delivered on
  // 'sessionstore-windows-restored' otherwise it's delivered immediately.
  let promise = reason === APP_STARTUP ? on('sessionstore-windows-restored') :
                                         function promise(deliver) deliver()

  // Once application is ready we spawn a new process with main module of
  // on add-on.
  promise(function() {
    try {
      loader.spawn(options.main, options.mainURI);
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
  if (loader)
    loader.unload(reason);
};
