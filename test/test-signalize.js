/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { merge } = require("sdk/util/object");
var tests = require("signalize/test/index");

Object.keys(tests).forEach(function(name) {
  exports[name] = tests[name]
});

require("test").run(exports);
