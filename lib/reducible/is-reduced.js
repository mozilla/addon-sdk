"use strict";

var reduced = require("./reduced")

function isReduced(value) {
  return value && value.is === reduced
}

module.exports = isReduced
