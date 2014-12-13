/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { require } = Components.utils.import(NATIVE_REQUIRE, {});
const { install, uninstall, startup, shutdown } = require("sdk/addon/bootstrap").Bootstrap();
