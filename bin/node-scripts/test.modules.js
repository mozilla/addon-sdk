/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var utils = require("./utils");
var readParam = utils.readParam;
var path = require("path");
var fs = require("fs");
var chai = require("chai");
var expect = chai.expect;
var assert = chai.assert;
var spawn = utils.spawn;
var sdk = path.join(__dirname, "..", "..");
var binary = process.env.JPM_FIREFOX_BINARY || "nightly";

var filter = readParam("filter");

describe("jpm test sdk modules", function () {
  it("SDK Modules", function (done) {
    process.chdir(sdk);

    var options = { cwd: sdk, env: { JPM_FIREFOX_BINARY: binary } };
    if (process.env.DISPLAY) {
      options.env.DISPLAY = process.env.DISPLAY;
    }

    options.filter = filter;

    var proc = spawn("test", options);

    var stdout = "";
    proc.stdout.on("data", function (data) {
      stdout += data;
    });

    proc.stderr.pipe(process.stderr);
    proc.stdout.pipe(process.stdout);
    proc.on("close", function(code) {
      expect(stdout).to.contain("All tests passed!");
      done();
    });
  });
});
