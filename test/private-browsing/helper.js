/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

let { Cc, Ci } = require('chrome');
const unload = require("sdk/system/unload");
const { Loader } = require('sdk/test/loader');
const { windows: windowsIterator } = require("sdk/window/utils");
const windows = require("windows").browserWindows;
const { merge } = require("sdk/util/object");

let { loader } = PBLoader({
  metadata: {'private-browsing': true},
  ignoreDeprecationErrors: true
});
const pb = loader.require('sdk/private-browsing');
const pbUtils = loader.require('sdk/private-browsing/utils');
const { getOwnerWindow } = loader.require('sdk/private-browsing/window/utils');

// need authority..
require('window/utils');
require('windows');
require('sdk/deprecated/window-utils');
require('sdk/private-browsing/window/utils');

function PBLoader(options) {
  options = options || {};
  let jpOptions = require("@loader/options");
  let packaging = {
    metadata: {}
  };

  shallowClone(jpOptions, packaging);
  shallowClone(options, packaging);

  shallowClone(jpOptions.metadata || {}, packaging.metadata);
  shallowClone(options.metadata || {}, packaging.metadata);

  let globals = {};
  let errors = [];

  if (options.ignoreDeprecationErrors) {
    globals.console = Object.create(console, {
      error: {
        value: function(e) {
          errors.push(e);
          if (!/DEPRECATED:/.test(e)) {
            console.error(e);
          }
        }
      }
    });
  }

  let loader = Loader(module, globals, packaging);

  return {
    loader: loader,
    errors: errors
  }
}

function shallowClone(source, target) {
  for (let prop in source) {
    if (!(prop in target))
      target[prop] = source[prop];
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
exports.PBLoader = PBLoader;
