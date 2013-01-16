/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

let { Cc,Ci } = require('chrome');
const unload = require("sdk/system/unload");
const { Loader } = require('sdk/test/loader');
const { windows: windowsIterator } = require("sdk/window/utils");
const windows = require("windows").browserWindows;

let { loader } = LoaderWithHookedConsole();
const pb = loader.require('sdk/private-browsing');
const pbUtils = loader.require('sdk/private-browsing/utils');

function LoaderWithHookedConsole() {
  let errors = [];
  let loader = Loader(module, {
    console: Object.create(console, {
      error: { value: function(e) {
        if (!/DEPRECATED:/.test(e)) {
          console.error(e);
        }
      }}
    })
  });

  return {
    loader: loader,
    errors: errors
  }
}

function activate() {
  if (pbUtils.isGlobalPBEnabled()) {
    pb.activate();
  }
  else if (pbUtils.isWindowPBEnabled()) {
    windows.open({private: true})
  }
}
exports.activate = activate;

function deactivate(callback) {
  if (callback)
    pb.once('stop', callback);

  if (pbUtils.isGlobalPBEnabled()) {
    pb.deactivate();
  }
  else if (pbUtils.isWindowPBEnabled()) {
    for each (let win in windowsIterator()) {
      if (pbUtils.isWindowPrivate(win)) {
        return win.close();
      }
    }
  }
}
exports.deactivate = deactivate;

exports.pb = pb;
exports.pbUtils = pbUtils;
exports.LoaderWithHookedConsole = LoaderWithHookedConsole;
