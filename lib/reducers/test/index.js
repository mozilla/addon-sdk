"use strict";

exports["test filter"] = require("./filter")
exports["test map"] = require("./map")
exports["test take"] = require("./take")
exports["test take while"] = require("./take-while")
exports["test drop"] = require("./drop")
exports["test drop while"] = require("./drop-while")
exports["test into"] = require("./into")
exports["test concat"] = require("./concat")
exports["test merge"] = require("./merge")

exports["test capture"] = require("./capture")

exports["test hub"] = require("./hub")

exports["test delay"] = require("./delay")
exports["test reductions"] = require("./reductions")
exports["test fold"] = require("./fold")


require("test").run(exports)
