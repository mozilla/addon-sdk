/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cu, Cc, Ci } = require("chrome");

// Note: much of this test code is from
// http://dxr.mozilla.org/mozilla-central/source/toolkit/mozapps/extensions/internal/XPIProvider.jsm
const BOOTSTRAP_REASONS = {
  APP_STARTUP     : 1,
  APP_SHUTDOWN    : 2,
  ADDON_ENABLE    : 3,
  ADDON_DISABLE   : 4,
  ADDON_INSTALL   : 5,
  ADDON_UNINSTALL : 6,
  ADDON_UPGRADE   : 7,
  ADDON_DOWNGRADE : 8
};

function makeBootstrapScope(options) {
  options = options || {};
  let id = options.id;
  let uri = options.uri;
  let globals = options.globals || {};

  let principal = Cc["@mozilla.org/systemprincipal;1"].
                  createInstance(Ci.nsIPrincipal);

  let bootstrapScope = new Cu.Sandbox(principal, {
    sandboxName: uri,
    wantGlobalProperties: ["indexedDB"],
    addonId: id,
    metadata: { addonID: id, URI: uri }
  });

  // Copy the reason values from the global object into the bootstrap scope.
  for (let name in BOOTSTRAP_REASONS)
    bootstrapScope[name] = BOOTSTRAP_REASONS[name];

  // As we don't want our caller to control the JS version used for the
  // bootstrap file, we run loadSubScript within the context of the
  // sandbox with the latest JS version set explicitly.
  bootstrapScope.__SCRIPT_URI_SPEC__ = uri;

  for (let key in globals) {
    bootstrapScope[key] = globals[key]
  }

  return bootstrapScope;
}
exports.makeBootstrapScope = makeBootstrapScope;
