"use strict";

var method = require("method")

// Returns `true` if given `value` is pending, otherwise returns
// `false`. All types will return false unless type specific
// implementation is provided to do it otherwise.
var isPending = method("is-pending")

isPending.define(function() { return false })

module.exports = isPending
