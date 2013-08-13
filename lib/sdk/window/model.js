/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Ci, Cu } = require("chrome");
const { Class } = require("../core/heritage");
const { Disposable } = require("../core/disposable");
const { setListeners } = require("../event/core");
const { compose, method, complement, memoize } = require("../lang/functional");
const { getWindowTitle, activate, close } = require("./utils");
const { isWindowPrivate } = require("../window/utils");
const { ignoreWindow } = require("../private-browsing/utils");
const { EventTarget } = require("../event/target");
const { getOwnerWindow } = require("../private-browsing/window/utils");
const { deprecateUsage } = require("../util/deprecate");
const { find } = require("../util/array");

const { TabList } = require("../windows/tabs-firefox");
const { viewFor } = require("../view/core");
const { modelFor } = require("../model/core");

let views = new WeakMap();

let isCompatible = complement(ignoreWindow)
let chainableMethod = f => compose(function() this, f, method(viewFor));
let tabsFor = memoize(view => TabList({ window: view })._public);

exports.tabsFor = tabsFor;

const BrowserWindow = Class({
  extends: EventTarget,
  implements: [Disposable],
  setup: function initialize(options) {
    let view = options.window;
    views.set(this, view);
    setListeners(this, options);
  },
  activate: chainableMethod(activate),
  close: chainableMethod(close),
  get title() getWindowTitle(viewFor(this)),
  // NOTE: Fennec only has one window, which is assumed below
  // TODO: remove assumption below
  // NOTE: tabs requires windows
  get tabs() tabsFor(viewFor(this)),
  get activeTab() this.tabs.activeTab,
  get isPrivateBrowsing() {
    deprecateUsage("`browserWindow.isPrivateBrowsing` is deprecated, please " +
                   "consider using " +
                   "`require('sdk/private-browsing').isPrivate(browserWindow)` " +
                   "instead.");
    return isWindowPrivate(viewFor(this));
  },
  dispose: function() {
    views.delete(this);
  }
});
exports.BrowserWindow = BrowserWindow;

// Implement `view` accessor method for the BrowserWindow class.
viewFor.define(BrowserWindow, model => views.get(model));
getOwnerWindow.define(BrowserWindow, viewFor);

// Implement `BrowserWindow` `model` accessor for `nsIDOMWindow`
// instances.
modelFor.define(Ci.nsIDOMWindow, view => {
  // To avoid circular references that needs to be broken up
  // use internal API for accessing keys of the weak map
  // that will be a models.
  let models = Cu.nondeterministicGetWeakMapKeys(views);
  // Find & return model for the the given view
  return find(models, model => viewFor(model) === view) ||
  // or create one if model does not existist
         BrowserWindow(view);
});
