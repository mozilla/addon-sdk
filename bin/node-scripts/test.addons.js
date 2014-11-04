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

var examplesPath = path.join(__dirname, "..", "..", "examples");
var addonsPath = path.join(__dirname, "..", "..", "test", "addons");

var binary = process.env.JPM_FIREFOX_BINARY || "nightly";

describe("jpm test sdk addons", function () {
  //beforeEach(utils.setup);
  //afterEach(utils.tearDown);

  fs.readdirSync(addonsPath)
  .filter(fileFilter.bind(null, addonsPath))
  .forEach(function (file) {
    it(file, function (done) {
      var addonPath = path.join(addonsPath, file);
      process.chdir(addonPath);

      var options = { cwd: addonPath, env: { JPM_FIREFOX_BINARY: binary }};
      if (process.env.DISPLAY) {
        options.env.DISPLAY = process.env.DISPLAY;
      }
      var proc = exec("run -v", options, function (err, stdout, stderr) {
        expect(err).to.not.be.ok;
        expect(stderr).to.not.be.ok;
        expect(stdout).to.contain("All tests passed!");
        done();
      });
    });
  });
});

function fileFilter(root, file) {
  if (/^(l10n|e10s|layout|simple-prefs|page-mod-debugger)/.test(file)) {
    return false;
  }
  var stat = fs.statSync(path.join(root, file))
  return (stat && stat.isDirectory());
}
