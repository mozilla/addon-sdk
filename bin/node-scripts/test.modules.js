/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var utils = require("./utils");
var path = require("path");
var fs = require("fs");
var chai = require("chai");
var expect = chai.expect;
var assert = chai.assert;
var exec = utils.exec;

var addonPath = path.join(__dirname, "..", "..");
var prefsPath = path.join(addonPath, "preferences", "test-preferences.js");

var binary = process.env.JPM_FIREFOX_BINARY || "nightly";

describe("jpm test sdk modules", function () {
  it("SDK Modules", function (done) {
    process.chdir(addonPath);

    var options = { cwd: addonPath, env: { JPM_FIREFOX_BINARY: binary }};
    if (process.env.DISPLAY) {
      options.env.DISPLAY = process.env.DISPLAY;
    }
    var proc = exec("test -v --prefs " + prefsPath, options, function (err, stdout, stderr) {
      expect(err).to.not.be.ok;
      console.log(stdout);
      expect(stdout).to.contain("All tests passed!");
      done();
    });
  });
});
