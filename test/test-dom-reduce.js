/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const hiddenWindow = Cc["@mozilla.org/appshell/appShellService;1"].
                     getService(Ci.nsIAppShellService).
                     hiddenDOMWindow;

// Shim the document as test expect access to document.body, which is ok as it
// only done for tests.
const document = hiddenWindow.document;
if (!document.body) document.body = document.documentElement;

require("dom-reduce/test/units")(exports, document);

require("test").run(exports);
