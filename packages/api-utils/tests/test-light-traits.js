"use strict";

exports["test traits from objects"] = require("./traits/object-tests");
exports["test traits from descriptors"] = require("./traits/descriptor-tests");

require("test").run(exports);
