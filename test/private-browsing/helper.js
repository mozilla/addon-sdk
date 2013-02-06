/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

let { Cc,Ci } = require('chrome');
const unload = require("sdk/system/unload");
const { Loader } = require('sdk/test/loader');
const { windows: windowsIterator } = require("sdk/window/utils");
const windows = require("windows").browserWindows;
const { merge } = require("sdk/util/object");

let { loader } = LoaderWithHookedConsole({'private-browsing': true});
const pb = loader.require('sdk/private-browsing');
const pbUtils = loader.require('sdk/private-browsing/utils');
const { getOwnerWindow } = require('sdk/private-browsing/window/utils');

// need authority..
require('window/utils');
require('windows');

function LoaderWithHookedConsole(metadata) {
  let options = JSON.parse(JSON.stringify(require("@loader/options")));
  options.metadata = merge(options.metadata, metadata);

  let errors = [];
  let loader = Loader(module, {
    console: Object.create(console, {
      error: { value: function(e) {
        if (!/DEPRECATED:/.test(e)) {
          console.error(e);
        }
      }}
    })
  }, options);

  return {
    loader: loader,
    errors: errors
  }
}

function deactivate(callback) {
  if (pbUtils.isGlobalPBSupported) {
    if (callback)
      pb.once('stop', callback);
    pb.deactivate();
  }
}
exports.deactivate = deactivate;
exports.loader = loader;
exports.pb = pb;
exports.pbUtils = pbUtils;
exports.getOwnerWindow = getOwnerWindow;
exports.LoaderWithHookedConsole = LoaderWithHookedConsole;
