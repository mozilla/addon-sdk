/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { createRemoteBrowser } = require("api-utils/window-utils");
const { channel } = require("./channel");
const packaging = require('@packaging');
const { when } = require('./unload');
const { MessageManager } = require('./message-manager');

const addonService = '@mozilla.org/addon/service;1' in Cc ?
  Cc['@mozilla.org/addon/service;1'].getService(Ci.nsIAddonService) : null

const ENABLE_E10S = packaging.enable_e10s;

const isFennec = require("./xul-app").is("Fennec");

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
    // Bug 724433: Take care to nullify all globals set by `cuddlefish.js`
    // otherwise, we will leak any still defined global.
    // `dump` is set in Loader.new method, `dump = globals.dump;`
    loadScript(target, 'data:,loader.unload("' + reason + '");' +
                       'loader = null; Loader = null; dump = null;', true);
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
    } else if (isFennec) {
      deliver(process(new MessageManager(), id, path));
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
