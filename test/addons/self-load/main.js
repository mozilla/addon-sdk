/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let LoaderModule = require("toolkit/loader");
let Traceback = require("sdk/console/traceback");

exports["test requiring loader"] = function (assert) {
  assert.equal(LoaderModule.join("file/to/path", "../yeah"), "file/to/yeah",
    "toolkit/loader loads itself and uses functions");
};

exports["test indirect include of toolkit/loader"] = function (assert) {
  let uri = "a -> b -> c";
  assert.equal(Traceback.sourceURI(uri), "c",
    "can load toolkit/loader indirectly via other SDK dependencies");
};

require("sdk/test/runner").runTestsFromModule(module);
