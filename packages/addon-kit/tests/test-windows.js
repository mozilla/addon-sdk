/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

if (require("api-utils/xul-app").is("Firefox")) {
  var tests = require("./windows/test-firefox-windows");
}
else if (require("api-utils/xul-app").is("Fennec")) {
  var tests = require("./windows/test-fennec-windows");
}

for (var test in tests)
  exports[test] = tests[test];
