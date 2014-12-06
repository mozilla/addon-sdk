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

function exec (args, options, callback) {
  options = options || {};
  var env = _.extend({}, options.env, process.env);

  return child_process.exec(["node", jpm, args, "-o", sdk].join(" "), {
    cwd: options.cwd || tmpOutputDir,
    env: env
  }, function (err, stdout, stderr) {
    if (callback)
      callback.apply(null, arguments);
    else if (err)
      throw err;
  });
}
exports.exec = exec;

function spawn (cmd, options) {
  options = options || {};
  var env = _.extend({}, options.env, process.env);

  return child_process.spawn("node", [jpm, cmd, "-v", "--prefs", prefsPath, "-o", sdk], {
    cwd: options.cwd || tmpOutputDir,
    env: env
  });
}
exports.spawn = spawn;
