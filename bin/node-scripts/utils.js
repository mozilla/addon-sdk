/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var _ = require("lodash");
var path = require("path");
var child_process = require("child_process");

function exec (args, options, callback) {
  options = options || {};
  var env = _.extend({}, options.env, process.env);

  return child_process.exec("node " + path.join(__dirname, "../../node_modules/jpm/bin/jpm") + " " + args + " -o " + path.join(__dirname, "../.."), {
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

function readParam(name) {
  var index = process.argv.indexOf("--" + name)
  return index >= 0 && process.argv[index + 1]
}
exports.readParam = readParam;
