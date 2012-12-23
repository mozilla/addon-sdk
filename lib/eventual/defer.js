"use strict";

var Eventual = require("./type")
var defer = function defer() { return new Eventual() }

module.exports = defer
