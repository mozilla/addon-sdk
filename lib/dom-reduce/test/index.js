/*jshint browser:true */
"use strict";

var units = require("./units")(exports, document);
module.exports = units;

require("test").run(exports);
