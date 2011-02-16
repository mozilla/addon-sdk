"use strict";

exports["test custom `Assert`'s"] = require("./commonjs-test-adapter/asserts");

// Disabling this check since it is not yet supported by jetpack.
// if (module == require.main)
  require("test").run(exports);
