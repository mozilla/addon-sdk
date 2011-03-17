"use strict";

exports["test traits from objects"] = require("./traits/object-tests");
exports["test traits from descriptors"] = require("./traits/descriptor-tests");
exports["test inheritance"] = require("./traits/inheritance-tests");

require("test").run(exports);
