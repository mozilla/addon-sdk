/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "stable"
};

const { Worker, setup: setupWorker, dispose: disposeWorker,
        attach, detach } = require("./content/worker");
const { Class } = require("./core/heritage");
const { HiddenFrame, addHidenFrame,
        removeHiddenFrame } = require("./frame/hidden-frame");
const { contentLoad, contentReady, contentCreate } = require("./content/states");
const { setListeners } = require("./event/core");
const { contract: loaderContract } = require("./content/loader");
const { contract } = require("./core/contract");
const { window } = require("./addon/window");
const { create: makeFrame, getDocShell } = require("./frame/utils");
const { merge } = require("./util/object");
const { method } = require("./lang/functional");

const models = WeakMap();
const views = WeakMap();

let pageContract = contract(merge({
  allow: {
    is: ["object", "undefined", "null"],
    map: function(allow) {
      return { script: !allow || allow.script !== false }
    }
  }
}, loaderContract.rules));


function isDisposed(page) {
  return !models.get(page, false)
}

function attachWorker(page, frame) {
  // Choose the timing based on mode configuration, wait for it and then
  // attach a worker.
  var when = page.contentScriptWhen;
  var ready = when === "ready" ? contentReady(frame) :
              when === "start" ? contentCreate(function(document) {
                return frame.contentDocument === document
              }) :
              contentLoad(frame)

  ready.then(function onWindowReady() {
    // Attach worker to a loaded window unless page-worker was disposed
    // in the meantime.
    if (!isDisposed(page)) attach(page, frame.contentWindow)
  }).then(null, console.exception);
}

function enableScript(page) {
  models.get(page).allow.script = true;
  getDocShell(views.get(page)).allowJavascript = true;
}

function disableScript(page) {
  models.get(page).allow.script = false;
  getDocShell(views.get(page)).allowJavascript = false;
}

function Allow(page) {
  return {
    get script() models.get(page).allow.script,
    set script(value) value ? enableScript(page) : disableScript(page)
  }
}

const Page = Class({
  implements: [
    pageContract.properties(function(value) {
      return models.get(value)
    })
  ],
  extends: Worker,
  setup: function(options) {
    let model = pageContract(options);

    models.set(this, model);

    setupWorker(this, options);
    setListeners(this, options);

    let view = makeFrame(window.document, {
      nodeName: "iframe",
      type: "content",
      uri: model.contentURL,
      allowJavascript: model.allow.script,
      allowPlugins: true,
      allowAuth: true,
    });
    views.set(this, view);

    attachWorker(this, view);
  },
  get allow() { return Allow(this); },
  set allow(value) {
    let allowJavascript = pageContract({ allow: value }).allow.script;
    return allowJavascript ? enableScript(this) : disableScript(this)
  },
  get contentURL() { return models.get(this).contentURL },
  set contentURL(value) {
    let model = models.get(this);
    let view = views.get(this);
    model.contentURL = pageContract({ contentURL: value }).contentURL;

    detach(this);
    view.setAttribute("src", model.contentURL);
    attachWorker(this, view);
  },
  dispose: function() {
    if (!isDisposed(this)) {
      let view = views.get(this);
      models.delete(this);
      views.delete(this);
      if (view.parentNode) view.parentNode.removeChild(view);

      disposeWorker(this);
    }
  }
});
exports.Page = Page;
