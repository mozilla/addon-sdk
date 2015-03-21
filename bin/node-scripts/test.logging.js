/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var utils = require("./utils");
var path = require("path");
var fs = require("fs");
var jpm = utils.run;
var readParam = utils.readParam;

var addonPath = path.join(__dirname, "..", "..", "test", "travis", "addons", "debug-logs");

var binary = process.env.JPM_FIREFOX_BINARY || "nightly";
var filterPattern = readParam("filter");

var START = "START TRACKING LOGGING HERE";
var END = "STOP TRACKING LOGGING HERE";

describe("jpm test logging in debug builds", function () {
  it(addonPath, function (done) {
    process.chdir(addonPath);

    var options = { cwd: addonPath, env: { JPM_FIREFOX_BINARY: binary }};
    if (process.env.DISPLAY) {
      options.env.DISPLAY = process.env.DISPLAY;
    }

    jpm("run", options).then(function(data) {
      var stdout = data.stdout;
      var startIndex = stdout.indexOf(START) + START.length;
      var endIndex = stdout.indexOf(END);
      stdout = stdout.substring(startIndex, endIndex)
      console.log(stdout);
    }).then(done).catch(done);
  });
});
