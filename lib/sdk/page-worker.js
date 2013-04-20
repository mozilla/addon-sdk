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
const { ignoreWindow } = require('./private-browsing/utils');
const { create: makeFrame, getDocShell } = require('./frame/utils');
const { contract } = require('./core/contract');
const { contract: loaderContract } = require('./content/loader');
const { has, ensureArray } = require('./util/array');
const { Rules } = require('./util/rules');
const { merge } = require('./util/object');

const models = WeakMap();
const views = WeakMap();
const workers = WeakMap();
const pages = WeakMap();

// Maps document events handled by observer and maps to contentScriptWhen
// options defined by developer
const readyEventMap = {
  'document-element-inserted': 'start',
  'load': 'end',
  'DOMContentLoaded': 'ready'
};
const readyEvents = Object.keys(readyEventMap);

function workerFor(page) workers.get(page)
function pageFor(view) pages.get(view)
function isDisposed (page) !models.get(page, false)

let pageContract = contract(merge({
  allow: {
    is: ['object', 'undefined', 'null'],
    map: function (allow) { return { script: !allow || allow.script !== false }}
  },
  onMessage: {
    is: ['function', 'undefined']
  },
  include: {
    is: ['string', 'array', 'undefined']
  }
}, loaderContract.rules));

function enableScript (page) {
  models.get(page).allow.script = true;
  getDocShell(views.get(page)).allowJavascript = true;
}

function disableScript (page) {
  models.get(page).allow.script = false;
  getDocShell(views.get(page)).allowJavascript = false;
}

function Allow (page) {
  return {
    get script() models.get(page).allow.script,
    set script(value) value ? enableScript(page) : disableScript(page)
  }
}

function injectWorker ({page}) {
  let worker = workers.get(page)
  let view = views.get(page)
  attach(worker, view.contentWindow);
}

function isValidURL(page, url) !page.rules || page.rules.matchesAny(url)

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

    if (model.include) {
      this.rules = Rules();
      this.rules.add.apply(this.rules, ensureArray(model.include));
    }

    // If it's local content and does not have a content script,
    // inject immediately
    if (requiresAddonGlobal(model))
      model.contentScriptWhen = 'start';

    if (
      (view.contentDocument.readyState === 'complete' ||
      (view.contentDocument.readyState === 'interactive' &&
        model.contentScriptWhen !== 'end')) &&
      view.contentDocument.location === model.contentURL) {
        injectWorker({page: page});
        return;
    }
    else
      on(this, 'ready', injectWorker)

  },
  get allow() { return Allow(this) },
  set allow(value) {
    let allowJavascript = pageContract({ allow: value }).allow.script;
    return allowJavascript ? enableScript(this) : disableScript(this);
  },
  get contentURL() { return models.get(this).contentURL; },
  set contentURL(value) {
    if (!isValidURL(this, value)) return;
    let model = models.get(this);
    let view  = views.get(this);
    let worker = workers.get(this);
    model.contentURL = pageContract({ contentURL: value }).contentURL;
    view.setAttribute('src', model.contentURL);
  },
  dispose: function () {
    if (isDisposed(this)) return;
    let view = views.get(this);
    if (view.parentNode) view.parentNode.removeChild(view);
    views.delete(this)
    models.delete(this)
    detach(workers.get(this));

    // Necessary? Should be GC'd once page is GC'd, and prevents error throwing
    // when calling methods after page is destroyed from passing in non-null
    // into WeakMap `workers`

    // workers.delete(this)
  }
});

exports.Page = Page;

/*
 * Filter out page events by `readyEvents`, and also filter
 * out private windows
 */
on(filter(events, function({type, target}) {
  return has(readyEvents, type) &&
         !ignoreWindow(target.defaultView);
  }), 'data', handleReadyEvents);

function handleReadyEvents ({target, type}) {
  // Check to see if document that fired an event is from
  // a page worker's iframe; exit otherwise
  let page = findMatchingPage(target);
  if (!page) return;

  if (page.contentScriptWhen === readyEventMap[type])
    emit(page, 'ready', { target: target, type: type, page: page });
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
    if (frames[i].contentDocument === doc && (page = pageFor(frames[i])))
      return page;
  return null;
}
