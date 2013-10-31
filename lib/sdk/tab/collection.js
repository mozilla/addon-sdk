/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { getTabs, getOwnerWindow, openTab, getTabId } = require("./utils");
const { ignoreWindow } = require("../private-browsing/utils");
const { modelFor } = require("../model/core");
const { fromViews } = require("../model/collection");
const { compose, partial } = require("../lang/functional");
const { first, map, seq } = require("../util/sequence");
const { Class } = require("../core/heritage");
const { Iterator } = require("../util/iterator");
const { EventTarget } = require("../event/target");
const { validateOptions } = require("../deprecated/api-utils");
const { isPrivateBrowsingSupported } = require("../self");
const { Tab } = require("./model");

// TODO: This has just being copied from `tabs/common` but can
// be improved.
let normalizeOptions = options => {
  if (typeof(options) === "string")
    options = { url: options };

  return validateOptions(options, {
    url: { is: ["string"] },
    inBackground: {
      map: function(v) !!v,
      is: ["undefined", "boolean"]
    },
    isPinned: { is: ["undefined", "boolean"] },
    isPrivate: { is: ["undefined", "boolean"] },
    onOpen: { is: ["undefined", "function"] },
    onClose: { is: ["undefined", "function"] },
    onReady: { is: ["undefined", "function"] },
    onLoad: { is: ["undefined", "function"] },
    onPageShow: { is: ["undefined", "function"] },
    onActivate: { is: ["undefined", "function"] },
    onDeactivate: { is: ["undefined", "function"] }
  });
};
exports.normalizeOptions = normalizeOptions;

// Make iterator of all browser windows that are compatible with
// required privacy constraints.
// TODO: Consider making `getTabs` an iterator instead of wrapping
// this function and avoid filtering compatible tabs everywhere.
let views = getTabs(null, { includePrivate: isPrivateBrowsingSupported });

let open = (window, options) => {
  // Get an active browser to use as window for the tab.
  window = window || getActiveBrowser();
  let view = openTab(window, options);
  // Instantiate model for the given tab view.
  let model = Tab({ id: getTabId(view) });
  // Set up event listeneres on the given tab.
  setListeners(model, options);

  return view;
};

// Define object that acts like tab model collection with
// indexed item acces & length + `activeTab`  getter &
// `open` method .
let Tabs = Class({
  extends: Iterator,
  implements: [EventTarget],
  initialize: function(window) {
    this.iterator = map(modelFor, getTabs(window, {
      includePrivate: isPrivateBrowsingSupported
    })).iterator;
    // Open method is composed. It validates options
    // opens tab with a given options and returns model
    // for the open tab: `modelFor(open(window, normalizeOptions(options)))`
    this.open = compose(modelFor, partial(open, window), normalizeOptions);
  }
});
exports.Tabs = Tabs;
exports.tabs = Tabs(null);
