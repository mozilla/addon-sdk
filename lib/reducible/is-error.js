"use strict";

var stringifier = Object.prototype.toString

function isError(value) {
  return stringifier.call(value) === "[object Error]"
}

module.exports = isError
