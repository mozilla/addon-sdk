"use strict";

// Consumption
exports.fold = require("./fold")

// Transformation
exports.filter = require("./filter")
exports.map = require("./map")
exports.reductions = require("./reductions")

// Combining streams
exports.concat = require("./concat")
exports.merge = require("./merge")

// Error handling
exports.capture = require("./capture")
exports.delay = require("./delay")

// Size changes
exports.dropWhile = require("./drop-while")
exports.drop = require("./drop")
exports.takeWhile = require("./take-while")
exports.take = require("./take")

// Multiplexing / sharing transformations
exports.hub = require("./hub")

// Development / debug
exports.print = require("./debug/print")
exports.into = require("./into")

// Transformation helper
exports.reducer = require("./reducer")
