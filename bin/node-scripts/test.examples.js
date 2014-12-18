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

var examplesPath = path.join(__dirname, "..", "..", "examples");

var binary = process.env.JPM_FIREFOX_BINARY || "nightly";
var filterPattern = readParam("filter");

describe("jpm test sdk examples", function () {
  fs.readdirSync(examplesPath)
  .filter(fileFilter.bind(null, examplesPath))
  .forEach(function (file) {
    it(file, function (done) {
      var addonPath = path.join(examplesPath, file);
      process.chdir(addonPath);

      var options = { cwd: addonPath, env: { JPM_FIREFOX_BINARY: binary }};
      if (process.env.DISPLAY) {
        options.env.DISPLAY = process.env.DISPLAY;
      }
      options.filter = filterPattern;

      var proc = spawn("test", options);

      proc.stderr.pipe(process.stderr);
      var output = [];
      proc.stdout.on("data", function (data) {
        output.push(data);
      });
      proc.on("close", function(code) {
        var out = output.join("");
        var hasFailure = /There were test failures\.\.\./.test(out);
        if (hasFailure || code != 0) {
          process.stdout.write(out);
        }
        expect(code).to.equal(hasFailure ? 1 : 0);
        expect(hasFailure).to.equal(false);
        done();
      });
    });
  });
});

function fileFilter(root, file) {
  var matcher = filterPattern && new RegExp(filterPattern)
  if (matcher && !matcher.test(file)) {
    return false;
  }
  var stat = fs.statSync(path.join(root, file))
  return (stat && stat.isDirectory());
}
