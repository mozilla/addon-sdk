/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
"use strict";

const { components } = require("chrome");
const traceback = require("./traceback");

function deprecatedUsage(msg) {
  // Print caller stacktrace in order to help figuring out which code
  // does use deprecated thing
  let stack = traceback.get().slice(0, -1);
  console.error("DEPRECATED: " + msg + "\n" + traceback.format(stack));
}
exports.deprecatedUsage = deprecatedUsage;

function deprecateFunction(fun, msg) {
  return function deprecated() {
    deprecatedUsage(msg);
    return fun.apply(this, arguments);
  };
}
exports.deprecateFunction = deprecateFunction;
