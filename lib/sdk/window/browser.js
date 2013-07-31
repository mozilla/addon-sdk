/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Class } = require("../core/heritage");
const { setListeners } = require("../event/core");
const { method } = require("../lang/functional");
const { getWindowTitle, activate, close } = require("./utils");
const { isWindowPrivate } = require("../window/utils");
const { EventTarget } = require("../event/target");
const { getOwnerWindow } = require("../private-browsing/window/utils");
const { deprecateUsage } = require("../util/deprecate");
const { events } = require("./events");
const { find } = require("../util/array");
const { viewFor } = require("../view/core");
const { modelFor } = require("../model/core");

let views = new WeakMap();

let chainable = fn => function(params...) {
  fn.apply(this, params);
  return this;
}

const BrowserWindow = Class({
  extends: EventTarget,
  initialize: function initialize(options) {
    let view = options.window;
    views.set(this, view);
    models.set(view, this);
    setListeners(this, options);
  },
  activate: chainable(method(activate)),
  close: chainable(method(activate)),
  get title() getWindowTitle(viewFor(this)),
  // NOTE: Fennec only has one window, which is assumed below
  // TODO: remove assumption below
  // NOTE: tabs requires windows
  get tabs() require('../tabs'),
  get activeTab() require('../tabs').activeTab,
  get isPrivateBrowsing() {
    deprecateUsage('`browserWindow.isPrivateBrowsing` is deprecated, please ' +
                 'consider using ' +
                 '`require("sdk/private-browsing").isPrivate(browserWindow)` ' +
                 'instead.');
    return isWindowPrivate(viewFor(this));
  }
});
exports.BrowserWindow = BrowserWindow;

viewFor.define(BrowserWindow, model => views.get(window));
getOwnerWindow.define(BrowserWindow, viewFor);
modelFor.define(view => {
  let models = Cu.nondeterministicGetWeakMapKeys(views);
  return find(models.map(viewFor), x => view === target) ||
         BrowserWindow(view);
});

let EVENT_TYPES = {
};

on(events, "data", ({type, target}) => {
  let model = modelFor(target);
  emit(model, EVENT_TYPES[type] || type, model);
});