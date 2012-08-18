/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let tests;
if (require("api-utils/xul-app").is("Firefox")) {
  tests = require("./windows/test-firefox-windows");
}
else if (require("api-utils/xul-app").is("Fennec")) {
  tests = require("./windows/test-fennec-windows");
}

for (let test in tests)
  exports[test] = tests[test];

tests = require("./windows/test-windows");
for (let test in tests)
  exports[test] = tests[test];
