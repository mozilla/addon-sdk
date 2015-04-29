/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var cp = require("child_process");
var Promise = require("promise");

var FILTER_TEST = /\[(module|addon|example)s?=([^\]\n]+)\]/ig;

function getLastMsg() {
  return new Promise(function(resolve) {
    cp.exec("git log -1 --pretty=%B", null, function(err, stdout, stderr) {
      resolve(stdout.trim());
    });
  });
}
exports.getLastMsg = getLastMsg;

function getFilters() {
  return new Promise(function(resolve) {
    getLastMsg().
    then(function(msg) {
      var filters = FILTER_TEST.exec(msg);
      var result = {};
      if (!filters) {
        return resolve(result);
      }
      for (var i = 0; i < filters.length; i = i + 3) {
        var name = filters[i + 1];
        result[name + "s"] = filters[i + 2];
      }
      return resolve(result);
    });
  })
}
exports.getFilters = getFilters;
