/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

// Hack: This is temporary hack to enable message channels on nightly.
require("sdk/preferences/service").set("dom.messageChannel.enabled", true);

const { window } = require("sdk/addon/window");
exports.MessageChannel = window.MessageChannel;
exports.MessagePort = window.MessagePort;
