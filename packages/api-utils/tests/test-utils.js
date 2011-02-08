"use strict";

exports["test types"] = require("./utils/type")

// Disabling this check since it is not yet supported by jetpack.
// if (module == require.main)
  require('test').run(exports)
