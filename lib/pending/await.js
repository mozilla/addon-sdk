"use strict";

var method = require("method")

// Set's up a callback to be called once pending
// value is realized. All object by default are realized.
var await = method("await")
await.define(function(value, callback) { callback(value) })

module.exports = await
