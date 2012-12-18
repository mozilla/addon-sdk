"use strict";

var map = require("../../map")

function lazy(f) {
  return map(1, function() { return f() })
}

module.exports = lazy
