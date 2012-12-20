/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { backgroundify, make, getDOMWindow } = require("../window/utils");
const { defer } = require("../core/promise");
const { when: unload } = require("../system/unload");

// Once Bug 565388 is fixed and shipped we'll be able to make invisible,
// permanent docShells. Meanwhile we create hidden top level window and
// use it's docShell. Also note that we keep a reference to xulWindow since
// otherwise it's unloaded, on the other hand this will require no cleanup
// from our side since once add-on is unloaded window will be removed
// automatically.
const xulWindow = backgroundify(make())
const docShell = xulWindow.docShell;

// Get a reference to the DOM window of the given docShell and load
// such document into that would allow us to create XUL iframes, that
// are necessary for hidden frames etc..
const window = docShell.contentViewer.DOMDocument.defaultView;
window.location = "data:application/xhtml+xml;charset=utf-8,<html/>";

// Create a promise that is delivered once add-on window is interactive,
// used by add-on runner to defer add-on loading until window is ready.
let { promise, resolve } = defer();
window.addEventListener("DOMContentLoaded", function handler(event) {
  window.removeEventListener("DOMContentLoaded", handler, false);
  resolve();
}, false);

exports.ready = promise;
exports.window = window;

// Still close window on unload to claim memory back early.
unload(function() { window.close() });
