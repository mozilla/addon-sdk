/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Ci } = require("chrome");
const { Class } = require("../core/heritage");
const { Disposable } = require("../core/disposable");
const { setListeners, once } = require("../event/core");
const { compose, method, memoize,
        chainable, query, isInstance, field } = require("../lang/functional");
const { getWindowTitle, getOuterId, activate, close,
        isWindowPrivate } = require("./utils");
const { EventTarget } = require("../event/target");
const { deprecated } = require("../util/deprecate");

const { Tabs } = require("../tab/collection");
const { viewFor } = require("../view/core");
const { modelFor, withView, getModel,
        attachView, detachView } = require("../model/core");

let deprecate = deprecated(
  "`browserWindow.isPrivateBrowsing` is deprecated, " +
  "please consider using " +
  "`require('sdk/private-browsing').isPrivate(browserWindow)` " +
  "instead.");

let models = new Map();

// withView = getWindowTitle => {
//   let view = viewFor(this)
//   return view && getWindowTitle(view)
// }
const browserFields = Object.create(null, {
  title: { get: withView(getWindowTitle) },
  tabs: { get: withView(memoize(Tabs)) },
  activeTab: { get: method(query("tabs.activeTab")) },
  isPrivateBrowsing: { get: deprecate(withView(isWindowPrivate)) }
});

const BrowserWindow = Class({
  extends: EventTarget,
  implements: [Disposable, browserFields],
  setup: function(options) {
    this.id = options.id;
    models.set(this.id, this);
    setListeners(this, options);
  },
  activate: chainable(withView(activate)),
  close: chainable(compose(withView(close), method((window, onClose) => {
          if (onClose)
            once(window, "close", onClose)
          }))),
  dispose: function() models.delete(this.id)
});
exports.BrowserWindow = BrowserWindow;

// viewFor(window) => getOuterId(window.id)
viewFor.define(BrowserWindow, compose(getOuterId, field("id")));

// Implement `BrowserWindow` `model` accessor for `nsIDOMWindow`
// instances.
modelFor.when(isInstance(Ci.nsIDOMWindow),
               compose(id => models.get(id), getOuterId));
