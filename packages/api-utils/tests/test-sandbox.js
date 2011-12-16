"use strict";

module.exports = Object.create(require("./sandbox/all"));

require("test").run(module.exports);
