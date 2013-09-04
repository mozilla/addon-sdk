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
const { modelFor, withView } = require("../model/core");
const { once, setListeners } = require("../event/core");
const { dispatcher } = require("../util/dispatcher");
const { deprecated } = require("../util/deprecate");
const { constant, compose } = require("sdk/lang/functional");
const { getThumbnailURIForWindow } = require("../content/thumbnail");
const { getFaviconURIForLocation } = require("../io/data");
const { getTabById, getTabTitle, setTabTitle, getTabContentType,
        getTabContentWindow, getTabURL, setTabURL, isPinned, pin,
        unpin, move, getIndex, getActiveTab, getTabId,
        activateTab, closeTab, reload, isXULTab,
        isFennecTab, unsupportedOnFennec } = require("./utils");


const DEP_FAVICON = "tab.favicon is deprecated, please use " +
                    "require('sdk/places/favicon').getFavicon instead.";
const BLANK_THUMBNAIL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAtCAYAAAA5reyyAAAAJElEQVRoge3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAADXBjhtAAGQ0AF/AAAAAElFTkSuQmCC";
const BLANK_FAVICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEklEQVQ4jWNgGAWjYBSMAggAAAQQAAF/TXiOAAAAAElFTkSuQmCC";


// `getFavicon` and `getThumbnail` utility function are defined here
// rather than in tab/utils to avoid adding dependencies on
// `content/thumbnail` and `io/data` modules.
let getFavicon = dispatcher("getFavicon@tab");
getFavicon.where(isXULTab, compose(getFaviconURIForLocation, getTabURL));
getFavicon.where(isFennecTab, compose(unsupportedOnFennec,
                                      constant(BLANK_FAVICON)));

let getThumbnail = dispatcher("getThumbnail@tab");
getThumbnail.where(isXULTab, compose(getThumbnailURIForWindow,
                                     getTabContentWindow));
getThumbnail.where(isFennecTab, compose(unsupportedOnFennec,
                                        constant(BLANK_THUMBNAIL)));

// Set of models fields that have getters / setters.
const tabFields = Object.create(null, {
  title: { get: withView(getTabTitle), set: withView(setTabTitle) },
  contentType: { get: withView(getTabContentType) },
  url: { get: withView(getTabURL), set: withView(setTabURL) },
  favicon: { get: deprecated(DEP_FAVICON, withView(getFavicon)) },
  style: { get: constant(null) },
  index: { get: withView(getIndex), set: withView(move) },
  isPinned: { get: withView(isPinned) }
});

let models = new Map();

const Tab = Class({
  extends: EventTarget,
  implements: [Disposable, tabFields],
  // Setup just associates given `options.view` to a model instance.
  setup: function(options) {
    this.id = options.id;
    models.set(this.id, this);
    setListeners(this, options);
  },
  dispose: function() models.delete(this.id),
  getThumbnail: withView(getThumbnail),
  pin: withView(pin),
  unpin: withView(unpin),
  reload: withView(reload),
  activate: withView(activateTab),

  attach: withView((view, options) => {
    let { Worker } = require("./worker");
    // BUG 792946 https://bugzilla.mozilla.org/show_bug.cgi?id=792946
    // TODO: fix this circular dependency
    return Worker(options, getTabContentWindow(view));
  }),
  close: function(callback) {
    if (callback) once(this, "close", callback);
    closeTab(viewFor(this));
  }
});
exports.Tab = Tab;

viewFor.define(Tab, getTabById);

let getModelByView = compose(id => models.get(id), getTabId);
modelFor.where(isXULTab, getModelByView);
// TODO: See if we can get access to fennecs Tab constructor to
// use disabled code instead:
// http://mxr.mozilla.org/mozilla-central/source/mobile/android/chrome/content/browser.js#2546
// medelFor.extend(Tab, getModelByView);
modelFor.where(isFennecTab, getModelByView);
