/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const addonPage = require("sdk/addon-page");
const pageUri = require("sdk/self").data.url("index.html");
const tabs = require("sdk/tabs");

exports["test addon-page addon global"] = function (assert, done) {
  addonPage.on("attach", function (worker) {
    worker.port.on("page-to-addon", function () {
      assert.pass("Emitted and received events in both ways");
      done();
    });
    worker.port.emit("addon-to-page");
  });
  tabs.open(pageUri);
}

require("sdk/test/runner").runTestsFromModule(module);
