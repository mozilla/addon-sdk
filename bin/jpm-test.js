/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var BLACKLIST = [];
var path = require("path");
var Mocha = require("mocha");
var mocha = new Mocha({
  ui: "bdd",
  reporter: "spec",
  timeout: 20000
});

process.env.NODE_ENV = "test";

[
  //path.join(__dirname, "..", "node-scripts", "test.modules.js"),
  path.join(__dirname, "..", "bin", "node-scripts", "test.addons.js")
].forEach(function(filepath) {
  mocha.addFile(filepath);
})

mocha.run(function (failures) {
  process.exit(failures);
});
