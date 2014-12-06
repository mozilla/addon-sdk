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
  timeout: 600000
});

var type = process.argv[2] || "";

process.env.NODE_ENV = "test";

[
  (type == "addons" || type == "") ? require.resolve("../bin/node-scripts/test.addons") : "",
  (type == "modules"|| type == "") ? require.resolve("../bin/node-scripts/test.modules") : ""
].forEach(function(filepath) {
  filepath && mocha.addFile(filepath);
})

mocha.run(function (failures) {
  process.exit(failures);
});
