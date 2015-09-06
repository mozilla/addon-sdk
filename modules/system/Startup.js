/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

// NOTE: We need to keep this file around for a time for older
// add-ons which may have used it (made with jpm < 0.0.24),
// we should remove this file around June 2015 to give devs a chance
// to migrate

this.EXPORTED_SYMBOLS = ["Startup"];
var exports = Cu.import("resource://gre/modules/commonjs/sdk/addon/startup.jsm", {});
var Startup = this.Startup = exports.Startup;
