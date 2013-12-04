/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { window } = require("sdk/addon/window");
const self = require("sdk/self");

exports["test relative URLs"] = assert => {
  assert.equal(window.document.baseURI + "data/",
               self.data.url(),
               "document's base URL is parte of data");

  let icon = new window.Image();
  icon.src = "./data/moz_favicon.ico";

  assert.equal(icon.src, self.data.url("moz_favicon.ico"),
               "images resolve relative to an add-on root");
};


require("sdk/test/runner").runTestsFromModule(module);
