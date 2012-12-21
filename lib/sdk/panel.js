/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "stable"
};

if (!require("./system/xul-app").is("Firefox")) {
  throw new Error([
    "The panel module currently supports only Firefox.  In the future ",
    "we would like it to support other applications, however.  Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=jetpack-panel-apps ",
    "for more information."
  ].join(""));
}

const { Cc, Ci } = require("chrome");
const { ns } = require("./core/namespace");
const { validateOptions: valid } = require('./deprecated/api-utils');
const { Class } = require("./core/heritage");
const { merge } = require("./util/object");
const { Worker, detach, attach,
        setup: setupWorker } = require("./content/worker");
const { contract: loaderContract } = require("./content/loader");
const { contract } = require("./core/contract");
const { emit, off, setListeners } = require('./event/core');
const utils = require("./panel/utils");
const { contentReady, eventPromise } = require("./content/states");


let panel = ns();
let isArray = Array.isArray;
let assetsURI = require('./self').data.url();


function isAddonContent({ contentURL }) {
  return typeof(contentURL) === "string" && contentURL.indexOf(assetsURI) === 0;
}

function hasContentScript({ contentScript, contentScriptFile }) {
  return (isArray(contentScript) ? contentScript.length > 0 :
         !!contentScript) ||
         (isArray(contentScriptFile) ? contentScriptFile.length > 0 :
         !!contentScriptFile);
}

function requiresAddonGlobal(model) {
  return isAddonContent(model) && !hasContentScript(model);
}

function getAttachType(model) {
  let when = model.contentScriptWhen;
  return requiresAddonGlobal(model) ? "content-change" :
         when === "start" ? "content-change" :
         when === "end" ? "content-load" :
         "content-ready";
}


let number = { is: ['number', 'undefined', 'null'] };
let panelContract = contract(merge({
  width: number,
  height: number,
}, loaderContract.rules));


function isDisposed(instance) {
  return !panel(instance).view;
}


const Panel = Class({
  implements: [
    panelContract.properties(function(value) { return panel(value).model })
  ],
  extends: Worker,
  setup: function setup(options) {
    let model = merge({
      width: 320,
      height: 240,
      shown: false,
    }, panelContract(options));

    setListeners(options);

    let view = utils.make();
    panel(this).model = model;
    panel(this).view = view;

    view.addEventListener("popupshown", this, true);
    view.addEventListener("popuphidden", this, true);

    utils.setURL(view, model.contentURL);

    setupWorker(this, options);
    if (isAddonContent(model) || hasContentScript(model)) {
      // Worker may detach when panel location changes, there for we
      // reattach it back to a new page once it's ready.
      view.addEventListener(getAttachType(model), this, false);
    }
  },
  handleEvent: function handleEvent(event) {
    try {
      let { view, model } = panel(this);

      if (event.type === "popupshown") {
        model.shown = true;
        return emit(this, "show");
      }

      if (event.type === "popuphidden") {
        model.shown = false;
        return emit(this, "hide");
      }

      attach(this, event.detail.defaultView);

    } catch(error) {
      emit(this, "error", error);
    }
  },
  dispose: function dispose() {
    this.hide();
    off(this);

    // defer cleanup to be performed after panel gets hidden
    let { view, model } = panel(this);
    panel(this).view = null;

    view.removeEventListener("popupshown", this, true);
    view.removeEventListener("popuphidden", this, true);
    view.removeEventListener(getAttachType(model), this, false);

    detach(this);
    utils.dispose(view);
  },
  /* Public API: Panel.width */
  get width() { return panel(this).model.width },
  set width(value) { this.resize(value, this.height); },
  /* Public API: Panel.height */
  get height() { return panel(this).model.height },
  set height(value) { this.resize(this.width, value); },

  get contentURL() { return panel(this).model.contentURL },
  set contentURL(value) {
    let { model, view } = panel(this);
    model.contentURL = panelContract({ contentURL: value }).contentURL;
    utils.setURL(view, model.contentURL);
  },

  /* Public API: Panel.isShowing */
  get isShowing() {
    return !isDisposed(this) && utils.isOpen(panel(this).view);
  },

  /* Public API: Panel.show */
  show: function show(anchor) {
    let { model, view } = panel(this);

    if (!isDisposed(this) && !model.shown) {
      model.shown = true;
      utils.show(view, model.width, model.height, anchor);
    }

    return this;
  },

  /* Public API: Panel.hide */
  hide: function hide() {
    let { view, model } = panel(this);

    // Quit immediately if panel is disposed or there is no state change.
    if (model.shown) {
      model.shown = false;
      utils.close(view);
    }

    return this;
  },

  /* Public API: Panel.resize */
  resize: function resize(width, height) {
    let { view, model } = panel(this);
    let change = panelContract({
      width: width || model.width,
      height: height || model.height
    });
    model.width = change.width
    model.height = change.height

    if (!isDisposed(this)) utils.resize(view, model.width, model.height);
  }
});
exports.Panel = Panel;
exports.internal = panel;
