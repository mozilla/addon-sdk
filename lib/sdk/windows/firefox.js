/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

const { BrowserWindow } = require("../window/model");
const { browserWindows } = require("../window/collection");
const { main } = require("../window/controller");

main();

exports.BrowserWindow = BrowserWindow;
exports.browserWindows = browserWindows;