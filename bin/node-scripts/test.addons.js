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
var spawn = utils.spawn;
var readParam = utils.readParam;

var addonsPath = path.join(__dirname, "..", "..", "test", "addons");

var binary = process.env.JPM_FIREFOX_BINARY || "nightly";
var filterPattern = readParam("filter");

describe("jpm test sdk addons", function () {
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
      options.filter = filterPattern;

      if (/^e10s/.test(file)) {
        options.e10s = true;
      }

      var proc = spawn("run", options);
      proc.stderr.pipe(process.stderr);
      proc.stdout.pipe(process.stdout);
      proc.on("close", function(code) {
        expect(code).to.equal(0);
        done();
      });
    });
  });
});

function fileFilter(root, file) {
  var matcher = filterPattern && new RegExp(filterPattern)
  if (/^(l10n|layout|simple-prefs|page-mod-debugger)/.test(file)) {
    return false;
  }
  if (matcher && !matcher.test(file)) {
    return false;
  }
  var stat = fs.statSync(path.join(root, file))
  return (stat && stat.isDirectory());
}
