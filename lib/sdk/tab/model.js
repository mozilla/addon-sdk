/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Closs } = require("../core/heritage");
const { viewFor } = require("../view/core");
const { modelFor } = require("../view/model");
const { deprecateFunction } = require('sdk/util/deprecate');

let fields = (descriptor) => Object.create(null, descriptor)

let method = (f) => function(...args) {
  let view = viewFor(this);
  args.unshift(view);
  // return `null` if associated view is no longer
  // alive.
  if (view)
    return f.apply(f, args)

  console.warn("Attempt to interact with disposed instance")
  return null;
}

let notImplemented = () => null

const DEP_FAVICON = "tab.favicon is deprecated, please use " +
                    "require('sdk/places/favicon').getFavicon instead.";

let views = new WeakMap();

const TabAccessors = Object.create({
  id: { get: method(getTabId) },
  title: { get: method(getTabTitle), set: method(setTabTitle) },
  contentType: { get: method(getTabContentType) },
  url: { get: method(getTabURL), set: method(setTabURL) },
  favicon: {
    get: deprecateFunction(function() {
      return this.url && getFaviconURIForLocation(this.url);
    }, DEP_FAVICON)
  },
  style: { get: notImplemented },
  index: { get: method(getIndex), set: method(move) },
  isPinned: { get: method(isPinned) }
});

const Tab = Class({
  extends: EventTarget,
  implements: [Disposable, TabAccessors],
  setup: function(options) {
    views.set(this, view);
  },
  dispose: function() {
    views.delete(this);
  },
  getThumbnail: method(compose(getThumbnailURIForWindow,
                               getTabContentWindow)),
  pin: method(pin),
  unpin: method(unpin),
  attach: method((view, options) => {
    let { Worker } = require("./worker");
    // BUG 792946 https://bugzilla.mozilla.org/show_bug.cgi?id=792946
    // TODO: fix this circular dependency
    return Worker(options, getTabContentWindow(view));
  }),
  activate: method(defer(activateTab)),
  close: method(callback => {
    // TODO: Implement
  }),
  reload: method(reload)
});

viewFor.define(Tab, tab => views.get(tab, null))
modelFor.define()

