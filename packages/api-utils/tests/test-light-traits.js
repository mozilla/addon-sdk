"use strict";

exports["test traits"] = require("./traits/test-all");

// Disabling this check since it is not yet supported by jetpack.
// if (module == require.main)
  require("test").run(exports);
