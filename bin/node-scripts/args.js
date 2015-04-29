/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var params = {};

function set(name, value) {
  return params[name] = value;
}
exports.set = set;


function get(name, defaultVal) {
  return params[name] || readParam(name) || defaultVal;
}
exports.get = get;

function readParam(name) {
  var index = process.argv.indexOf("--" + name)
  return index >= 0 && process.argv[index + 1]
}
exports.readParam = readParam;
