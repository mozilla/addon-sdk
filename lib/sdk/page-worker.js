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
const { on, emit, off, setListeners } = require('./event/core');
const { filter, pipe } = require('./event/utils');
const { WorkerHost, Worker, detach, attach } = require('./worker/utils');
const { Disposable } = require('./core/disposable');
const { EventTarget } = require('./event/target');
const { unload } = require('./system/unload');
const { events } = require('./content/events');
const { requiresAddonGlobal } = require('./content/utils');
const { window } = require('./addon/window');
const { getDocShellTreeItem } = require('./window/utils');
const { create: makeFrame } = require('./frame/utils');
const { contract } = require('./core/contract');
const { contract: loaderContract, getDocShell } = require('./content/loader');
const { has } = require('./util/array');
const { merge } = require('./util/object');

const models = WeakMap();
const views = WeakMap();
const workers = WeakMap();
const pages = WeakMap();

const DEFAULTS = {
  'contentURL': 'about:blank'
};

// Maps document events handled by observer and maps to contentScriptWhen
// options defined by developer
const readyEventMap = {
  'document-element-inserted': 'start',
  'load': 'end',
  'DOMContentLoaded': 'ready'
};
const readyEvents = Object.keys(readyEventMap);

let pageContract = contract(merge({
  allow: {
    is: ['object', 'undefined', 'null'],
    map: function (allow) { return { script: !allow || allow.script !== false }}
  }
}, loaderContract.rules));

/*
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
*/

function workerFor(page) workers.get(page)
function pageFor(view) pages.get(view)

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

function setInjectListeners (page) {
  let model = models.get(page);
  let when = model.contentScriptWhen;
  let frame = views.get(page);

  // If it's local content and does not have a content script,
  // inject immediately
  if (requiresAddonGlobal(model))
    when = 'start';

  model.loadEvent = when;

  if (
    (frame.contentDocument.readyState === 'complete' ||
    (frame.contentDocument.readyState === 'interactive' && when !== 'end')) &&
    frame.contentDocument.location === model.contentURL) {
    injectWorker(page);
    return;
  }
  on(page, 'ready', injectWorker)
}

function removeInjectListeners (page) {

}

function injectWorker ({page}) {
  let worker = workers.get(page)
  let view = views.get(page)
  attach(worker, view.contentWindow);
}

const Page = Class({
  implements: [
    pageContract.properties(function (value) models.get(value)),
    EventTarget,
    Disposable
  ],
  extends: WorkerHost(workerFor),
  setup: function Page(options) {
    let model = pageContract(options);
    models.set(this, model);

    setListeners(this, options);

    let view = makeFrame(window.document, {
      nodeName: 'iframe',
      type: 'content',
      uri: model.contentURL,
      allowJavascript: model.allow.script,
      allowPlugins: true,
      allowAuth: true
    });
    views.set(this, view);
    pages.set(view, this);

    let worker = new Worker(options);
    workers.set(this, worker);
    pipe(worker, this);

    setInjectListeners(this);

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
  get contentURL() { return models.get(this).contentURL; },
  set contentURL(value) {
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
  }
});

exports.Page = Page;

// Filter out page events by `readyEvents`
let pageEvents = filter(function({type}) has(readyEvents, type), events);
on(pageEvents, 'data', handleReadyEvents);

function handleReadyEvents ({target, type}) {
  // Check to see if document that fired an event is from
  // a page worker's iframe; exit otherwise
  let page = findMatchingPage(target);
  if (!page) return;

  // Check to see if the event that was fired from a page worker's
  // iframe should initiate the worker injection
  if (page.contentScriptWhen === readyEventMap[type]) {
    emit(page, 'ready', { target: target, type: type, page: page });
  }
}

/*
 * Takes a document, finds its doc shell tree root and returns the
 * matching Page instance if found
 */
function findMatchingPage (doc) {
  let rootWindow = getDocShellTreeItem(doc.defaultView), page;
  if (!rootWindow) return;

  let frames = rootWindow.document.getElementsByTagName('iframe');
  for (let i = frames.length; i--;)
    if (page = pageFor(frames[i])) return page;
  
  return null;
}


function onStart (doc) {
    let window = doc.defaultView;

    if (ignoreWindow(window)) return;

    if (window && window === frame.contentWindow) {
      removeInjectListeners(page);
      injectWorker(page);
    }
  }

  function onReady (event) {
    if (event.target !== frame.contentDocument) return;
    removeInjectListeners(page);
    injectWorker(page);
  }
