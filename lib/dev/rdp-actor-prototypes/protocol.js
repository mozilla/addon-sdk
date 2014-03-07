/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// HACK: load protocol.js from addon-sdk addon
const { Cu } = require("chrome");

Cu.import("resource://gre/modules/Services.jsm");
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const devtool_loader = devtools.require;
const protocol = devtool_loader("devtools/server/protocol");
//console.log("DEVTOOL LOADER", devtool_loader, protocol);

exports.protocol = protocol;

// HACK: actors and its helper needs to use the "sdk/event/core"
// from the DevTools loader
exports.events = devtool_loader("sdk/event/core");
