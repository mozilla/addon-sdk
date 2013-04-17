/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "stable"
};

const { Class } = require('./core/heritage');
const { emit, off, setListeners } = require('./event/core');
const { filter, pipe } = require('./event/utils');
const { WorkerHost, Worker, detach, attach } = require('./worker/utils');
const { unload } = require('./system/unload');
const { contract } = require('./core/contract');
const { contract: loaderContract } = require('./content/loader');
const { has } = require('./util/array');
const { merge } = require('./util/object');

const models = WeakMap();
const views = WeakMap();
const workers = WeakMap();

const DEFAULTS = {
  'contentURL': 'about:blank'
};

let pageContract = contract(merge({
  allow: {
    is: ['object', 'undefined', 'null'],
    map: function (allow) return { script: !allow || allow.script !== false }
  }
}, loaderContract.rules));

function attachWorker (page, frame) {
  // Choose the timing based on mode configuration, wait for event
  // and attach worker.
  var when = page.contentScriptWhen;
  var ready = when === 'ready' ? contentReady(frame) :
              when === 'start' ? contentCreate(function (document) {
                return frame.contentDocument === document;
              }) :
              contentLoad(frame);

  ready.then(function onWindowReady () {
    // Attach a worker to a loaded window unless page-worker was
    // disposed in the interim
    if (!isDisposed(page)) attach(page, frame.contentWindow)
  }).then(null, console.exception);
}

function workerFor(page) workers.get(panel)

function setScript (page, status) {
  models.get(page).allow.script = status;
  getDocShell(views.get(page)).allowJavascript = status;
}

function enableScript (page) setScript(page, true)
function disableScript (page) setScript(page, false)

function Allow (page) {
  return {
    get script() models.get(page).allow.script,
    set script(value) value ? enableScript(page) : disableScript(page)
  }
}

const Page = Class({
  implements: [
    pageContract.properties(function (value) models.get(value))
  ],
  extends: WorkerHost(workerFor),
  constructor: function Page(options) {
    setListeners(this, options);
    
    let model = pageContract(options);
    models.set(this, model);

    let worker = new Worker(options);
    workers.set(this, worker);
    pipe(worker, this);

    let view = makeFrame(window.document, {
      nodeName: 'iframe',
      type: 'content',
      uri: model.contentURL,
      allowJavascript: model.allow.script,
      allowPlugins: true,
      allowAuth: true
    });
    views.set(this, view);

    attach(worker, view);
    /*
    if (this.include) {
      let include = this.include;
      this.include = Rules();
      this.include.add.apply(this.include, ensureArray(include));
    }*/

  },
  get allow() { return Allow(this) },
  set allow(value) {
    let allowJavascript = pageContract({ allow: value }).allow.script;
    return allowJavascript ? enableScript(this) : disableScript(this);
  },
  getContentURL() { return models.get(this).contentURL; },
  setContentURL(value) {
    let model = models.get(this);
    let view = views.get(this);
    let worker = workers.get(this);
    model.contentURL = pageContract({ contentURL: value }).contentURL;
    detach(this);
    view.setAttribute('src', model.contentURL);
    attach(worker, view);
  },
  dispose: function () {
    if (isDisposed(this)) return;
    let view = views.get(this);
    models.delete(this)
    workers.delete(this)
    if (view.parentNode) view.parentNode.removeChild(view);
    disposeWorker(this);
  },

  destroy: function () {
    // workerDestroy
    // unregisterListener
    // _frame = null
    if (this._hiddenFrame) {
      removeFrame(this._hiddenFrame);
      this._hiddenFrame = null;
    }
  }
});

exports.Page = Page;
