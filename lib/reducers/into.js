"use strict";

var fold = require("./fold")

function into(source, buffer) {
  /**
  Adds items of given `reducible` into
  given `array` or a new empty one if omitted.
  **/
  return fold(source, function foldInto(value, result) {
    result.push(value)
    return result
  }, buffer || [])
}

module.exports = into
