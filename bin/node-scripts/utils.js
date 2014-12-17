/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var _ = require("lodash");
var path = require("path");
var child_process = require("child_process");
var jpm = require.resolve("../../node_modules/jpm/bin/jpm");

var sdk = path.join(__dirname, "..", "..");
var prefsPath = path.join(sdk, "test", "preferences", "test-preferences.js");

function spawn (cmd, options) {
  options = options || {};
  var env = _.extend({}, options.env, process.env);

  return child_process.spawn("node", [
    jpm, cmd, "-v",
    "--prefs", prefsPath,
    "-o", sdk,
    "-f", options.filter || ""
  ], {
    cwd: options.cwd || tmpOutputDir,
    env: env
  });
}
exports.spawn = spawn;

function readParam(name) {
  var index = process.argv.indexOf("--" + name)
  return index >= 0 && process.argv[index + 1]
}
exports.readParam = readParam;
