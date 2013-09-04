/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

let { getFocusedBrowser, browsers, openDialog } = require("./utils");
let { modelFor } = require("../model/core");
let { fromViews } = require("../model/collection");
let { compose } = require("../lang/functional");
let { map } = require("../util/sequence");
let { getActiveBrowser } = require("../private-browsing/utils");
let { isPrivateBrowsingSupported } = require("../self");
let { Class } = require("../core/heritage");
let { Indexed } = require("../model/indexed");
let { EventTarget } = require("../event/target");
let { BrowserWindow } = require("./model");

// Todo: Get rid of tab dependency.
let { normalizeOptions } = require("../tab/collection");

// Make iterator of all browser windows that are compatible with
// required privacy constraints.
let views = browsers({ includePrivate: isPrivateBrowsingSupported });

// Opens a new browser window with a given options & returns it.
let openBrowser = (options) => {
  if (typeof(options) === "string") {
    options = {
      tabs: [Options(options)],
      isPrivate: isPrivateBrowsingSupported && options.isPrivate
    };
  }

  let uris = [];
  if (options.tabs) {
    uris = [].concat(options.tabs).
              map(Options).
              map(({url}) => url);
  }
  else if (options.url) {
    uris = [options.url];
  }

  return openDialog({
    private: options.isPrivate,
    args: uris.join("|")
  });
}
exports.openBrowser = openBrowser;

// Define object that acts like window model collection with
// indexed item acces & length + `activeWindow`  getter &
// `open` method .
let BrowserWindows = Class({
  extends: Indexed,
  implements: [EventTarget, map(modelFor, views)],
  get activeWindow() modelFor(getActiveBrowser()),
  open: compose(modelFor, openBrowser)
});
exports.browserWindows = BrowserWindows();
