/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var cp = require("child_process");

var FILTER_TEST = /\[(module|addon|example)s?=([^\]\n]+)\]/ig;

function getLastMsg() {
  var message = cp.execSync("git log -1 --pretty=%B");
  return message;
}
exports.getLastMsg = getLastMsg;

function getFilters() {
  var msg = getLastMsg();
  var filters = FILTER_TEST.exec(msg);
  var result = {};
  if (!filters) {
    return result;
  }
  for (var i = 0; i < filters.length; i = i + 3) {
    var name = filters[i + 1];
    result[name + "s"] = filters[i + 2];
  }
  return result;
}
exports.getFilters = getFilters;
