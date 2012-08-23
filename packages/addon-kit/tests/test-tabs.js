/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

if (require("api-utils/xul-app").is("Firefox")) {
  var tests = require("./tabs/test-firefox-tabs");
}
else if (require("api-utils/xul-app").is("Fennec")) {
  var tests = require("./tabs/test-fennec-tabs");
}

for (var test in tests)
  exports[test] = tests[test];

tests = require("./tabs/test-tabs");
for (let test in tests)
  exports[test] = tests[test];
