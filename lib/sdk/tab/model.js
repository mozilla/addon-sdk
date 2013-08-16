/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Class } = require("../core/heritage");
const { EventTarget } = require("../event/target");
const { Disposable } = require("../core/disposable");
const { viewFor } = require("../view/core");
const { modelFor, withView } = require("../view/model");
const { deprecateFunction } = require('sdk/util/deprecate');
const { method, constant, compose } = require("sdk/lang/functional");
const { field } = require("sdk/util/oops");
const { getThumbnailURIForWindow } = require("../content/thumbnail");
const { getFaviconURIForLocation } = require("../io/data");
const { getTabById, getTabTitle, setTabTitle, getTabContentType,
        getTabContentWindow, getTabURL, setTabURL, isPinned, pin,
        unpin, move, getIndex, getActiveTab, getTabId,
        activateTab, closeTab, reload } = require("../tabs/utils");


const DEP_FAVICON = "tab.favicon is deprecated, please use " +
                    "require('sdk/places/favicon').getFavicon instead.";

const tabFields = Object.create(null, {
  title: { get: withView(getTabTitle), set: withView(setTabTitle) },
  contentType: { get: withView(getTabContentType) },
  url: { get: withView(getTabURL), set: withView(setTabURL) },
  // TODO: Disable for fennec
  favicon: {
    get: deprecateFunction(compose(getFaviconURIForLocation,
                                   method(field("url"))),
                           DEP_FAVICON)
  },
  style: { get: constant(null) },
  index: { get: withView(getIndex), set: withView(move) },
  // TODO: Log warning and return false.
  isPinned: { get: withView(isPinned) }
});

const Tab = Class({
  extends: EventTarget,
  implements: [Disposable, tabFields],
  // Setup just associates given `options.view` to a model instance.
  setup: function(options) {
    this.id = options.id;
    models.set(this.id, this);
    setListeners(this, options);
  },
  // Dispose just deassociates `options.view` from the model.
  dispose: method(detachView),
  // TODO: Disable for fennec
  getThumbnail: withView(compose(getThumbnailURIForWindow,
                                 getTabContentWindow)),
  // TODO: Log warnings on fennec
  pin: withView(pin),
  unpin: withView(unpin),

  attach: withView((view, options) => {
    let { Worker } = require("./worker");
    // BUG 792946 https://bugzilla.mozilla.org/show_bug.cgi?id=792946
    // TODO: fix this circular dependency
    return Worker(options, getTabContentWindow(view));
  }),
  activate: withView(activateTab),
  close: function(callback) {
    if (callback) on(this, "close", callback);
    closeTab(viewFor(this));
  },
  reload: withView(reload),
  dispose: function() models.delete(this.id)
});

viewFor.define(Tab, getTabById);
// Define `modelFor` implementation for `tab` XUL nodes
// which will return model associated with it, creating
// on if it does not exists yet.
let modelFrom = compose(id => models.get(id), getTabId);
modelFor.where(x => x && x.tagName === "tab", modelFrom);
// TODO: See if we can get access to fennecs Tab constructor to
// use disabled code instead:
// http://mxr.mozilla.org/mozilla-central/source/mobile/android/chrome/content/browser.js#2546
// medelFor.extend(Tab, modelFrom);
modelFor.where(x => x.constructor.name === "Tab", modelFrom);
