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
 *   Irakli Gozalishvili <gozala@mozilla.com>
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

"use strict";

const { Cc, Ci } = require("chrome");
const { createRemoteBrowser } = require("api-utils/window-utils");
const { channel } = require("./channel");
const { setTimout } = require('./timer');
const packaging = require('@packaging');
const { when } = require('./unload');

const addonService = '@mozilla.org/addon/service;1' in Cc ?
  Cc['@mozilla.org/addon/service;1'].getService(Ci.nsIAddonService) : null

const ENABLE_E10S = packaging.enable_e10s;

function loadScript(target, uri, sync) {
  return 'loadScript' in target ? target.loadScript(uri, sync)
                                : target.loadFrameScript(uri, sync)
}

function process(target, id, path, scope) {
  // Please note that even though `loadScript`, is executed before channel is
  // returned, users still are able to subscribe for messages before any message
  // will be sent. That's because `loadScript` queues script execution on the
  // other process, which means they will execute async (on the next turn of
  // event loop), while the channel for messages is returned immediately (in
  // the same turn of event loop).

  loadScript(target, packaging.uriPrefix + packaging.loader, false);
  loadScript(target, 'data:,let loader = Loader.new(' +
                      JSON.stringify(packaging) + ');\n' +
                     'loader.main("' + id + '", "' + path + '");', false);

  when(function (reason) {
    // Please note that it's important to unload remote loader
    // synchronously (using synchronous frame script), to make sure that we
    // don't stop during unload.
    loadScript(target, 'data:,loader.unload("' + reason + '")', true);
  });

  return { channel: channel.bind(null, scope, target) }
}

exports.spawn = function spawn(id, path) {
  return function promise(deliver) {
    // If `nsIAddonService` is available we use it to create an add-on process,
    // otherwise we fallback to the remote browser's message manager.
    if (ENABLE_E10S && addonService) {
      console.log('!!!!!!!!!!!!!!!!!!!! Using addon process !!!!!!!!!!!!!!!!!!');
      deliver(process(addonService.createAddon(), id, path));
    } else {
      createRemoteBrowser(ENABLE_E10S)(function(browser) {
        let messageManager = browser.QueryInterface(Ci.nsIFrameLoaderOwner).
                                     frameLoader.messageManager
        let window = browser.ownerDocument.defaultView;
        deliver(process(messageManager, id, path, window));
      });
    }
  };
};
