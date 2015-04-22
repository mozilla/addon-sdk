/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const rootURI = `__SCRIPT_URI_SPEC__.replace("bootstrap.js", "src/")`;
const writeBootstrap = (mountURI, manifest) =>
`"use strict";
const { utils: Cu } = Components;
const {require} = Cu.import("resource://gre/modules/commonjs/toolkit/require.js", {});
const {Bootstrap} = require("resource://gre/modules/commonjs/sdk/addon/bootstrap");
const {startup, shutdown, install, uninstall} = new Bootstrap(${mountURI ? `"${mountURI}"` : rootURI});
`
exports.writeBootstrap = writeBootstrap;
