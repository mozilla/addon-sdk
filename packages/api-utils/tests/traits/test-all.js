"use strict";

exports["test traits from objects"] = require("./traits");
exports["test traits from property descriptor maps"] = require("./descriptor");

if (module == require.main)
  require("test").run(exports);
