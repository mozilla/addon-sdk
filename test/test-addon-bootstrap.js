/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { makeBootstrapScope } = require("./native/scope");
const { evaluate } = require("sdk/loader/sandbox");

const NATIVE_REQUIRE = require.resolve("toolkit/require.js");

exports["test minimal bootstrap.js"] = function(assert) {
  let uri = require.resolve("./fixtures/native/minimal/bootstrap.js");

  let bootstrapScope = makeBootstrapScope({
    id: "test-min-boot@jetpack",
    uri: uri,
    globals: {
      NATIVE_REQUIRE: NATIVE_REQUIRE
    }
  })

  assert.equal(typeof bootstrapScope.install, "undefined", "install DNE");
  assert.equal(typeof bootstrapScope.startup, "undefined", "startup DNE");
  assert.equal(typeof bootstrapScope.shutdown, "undefined", "shutdown DNE");
  assert.equal(typeof bootstrapScope.uninstall, "undefined", "uninstall DNE");

  evaluate(bootstrapScope,
    "Comp" + "onents.classes['@mozilla.org/moz/jssubscript-loader;1'] \
               .createInstance(Compo" + "nents.interfaces.mozIJSSubScriptLoader) \
               .loadSubScript(__SCRIPT_URI_SPEC__);", "ECMAv5");

  assert.equal(typeof bootstrapScope.install, "function", "install exists");
  assert.equal(typeof bootstrapScope.startup, "function", "startup exists");
  assert.equal(typeof bootstrapScope.shutdown, "function", "shutdown exists");
  assert.equal(typeof bootstrapScope.uninstall, "function", "uninstall exists");

  bootstrapScope.shutdown(null, BOOTSTRAP_REASONS.ADDON_DISABLE);
}


exports["test destructured minimal bootstrap.js"] = function(assert) {
  let uri = require.resolve("./fixtures/native/destructured-minimal/bootstrap.js");

  let bootstrapScope = makeBootstrapScope({
    id: "test-de-min-boot@jetpack",
    uri: uri,
    globals: {
      NATIVE_REQUIRE: NATIVE_REQUIRE
    }
  })

  assert.equal(typeof bootstrapScope.install, "undefined", "install DNE");
  assert.equal(typeof bootstrapScope.startup, "undefined", "startup DNE");
  assert.equal(typeof bootstrapScope.shutdown, "undefined", "shutdown DNE");
  assert.equal(typeof bootstrapScope.uninstall, "undefined", "uninstall DNE");

  evaluate(bootstrapScope,
    "Comp" + "onents.classes['@mozilla.org/moz/jssubscript-loader;1'] \
               .createInstance(Compo" + "nents.interfaces.mozIJSSubScriptLoader) \
               .loadSubScript(__SCRIPT_URI_SPEC__);", "ECMAv5");

  assert.equal(typeof bootstrapScope.install, "function", "install exists");
  assert.equal(typeof bootstrapScope.startup, "function", "startup exists");
  assert.equal(typeof bootstrapScope.shutdown, "function", "shutdown exists");
  assert.equal(typeof bootstrapScope.uninstall, "function", "uninstall exists");

  bootstrapScope.shutdown(null, BOOTSTRAP_REASONS.ADDON_DISABLE);
}

require("sdk/test").run(exports);
