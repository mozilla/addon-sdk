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
const { filter, pipe, map } = require('./event/utils');
const { WorkerHost, Worker, detach, attach } = require('./worker/utils');
const { Disposable } = require('./core/disposable');
const { EventTarget } = require('./event/target');
const { unload } = require('./system/unload');
const { events } = require('./content/events');
const { isAddonGlobalRequired } = require('./content/utils');
const { window } = require('./addon/window');
const { getDocShellTreeItem } = require('./window/utils');
const { create: makeFrame, getDocShell } = require('./frame/utils');
const { contract } = require('./util/contract');
const { contract: loaderContract } = require('./content/loader');
const { has } = require('./util/array');
const { Rules } = require('./util/rules');
const { merge } = require('./util/object');

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

function workerFor(page) workers.get(page)
function pageFor(view) pages.get(view)
function isDisposed (page) !views.get(page, false)

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
  getDocShell(views.get(page)).allowJavascript = true;
}

function disableScript (page) {
  getDocShell(views.get(page)).allowJavascript = false;
}

function Allow (page) {
  return {
    get script() getDocShell(views.get(page)).allowJavascript,
    set script(value) value ? enableScript(page) : disableScript(page)
  }
}

function injectWorker ({page}) {
  let worker = workers.get(page);
  let view = views.get(page);
  if (isValidURL(page, view.contentDocument.location.href))
    attach(worker, view.contentWindow);
}

function isValidURL(page, url) !page.rules || page.rules.matchesAny(url)

const Page = Class({
  implements: [
    pageContract.properties(function (value) views.get(value)),
    EventTarget,
    Disposable
  ],
  extends: WorkerHost(workerFor),
  setup: function Page(options) {
    let init = pageContract(options);
    setListeners(this, options);
    let view = makeFrame(window.document, {
      nodeName: 'iframe',
      type: 'content',
      uri: init.contentURL,
      allowJavascript: init.allow.script,
      allowPlugins: true,
      allowAuth: true
    });

    view.contentScriptWhen = init.contentScriptWhen;

    views.set(this, view);
    pages.set(view, this);

    let worker = new Worker(options);
    workers.set(this, worker);
    pipe(worker, this);

    if (init.include) {
      this.rules = Rules();
      this.rules.add.apply(this.rules, [].concat(init.include));
    }

    // If it's local content and does not have a content script,
    // inject immediately
    if (isAddonGlobalRequired(init))
      view.contentScriptWhen = 'start';

    if (
      (view.contentDocument.readyState === 'complete' ||
      (view.contentDocument.readyState === 'interactive' &&
        view.contentScriptWhen !== 'end')) &&
      view.contentDocument.location === init.contentURL) {
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
  get contentURL() { return views.get(this).getAttribute('src'); },
  set contentURL(value) {
    if (!isValidURL(this, value)) return;
    let view  = views.get(this);
    let contentURL = pageContract({ contentURL: value }).contentURL;
    view.setAttribute('src', contentURL);
  },
  dispose: function () {
    if (isDisposed(this)) return;
    let view = views.get(this);
    if (view.parentNode) view.parentNode.removeChild(view);
    views.delete(this)
    detach(workers.get(this));
  }
});

exports.Page = Page;

let readyEvents = filter(events, isReadyEvent);
let pageEvents = map(readyEvents, function({target, type}) {
  return { type: type, target: target, page: pageFromDoc(target) };
});
let pageReadyEvents = filter(pageEvents, function({page, type}) {
  return page && page.contentScriptWhen === readyEventMap[type];
});
on(pageReadyEvents, 'data', function({page, type}) {
  emit(page, 'ready', {page: page});
});

function isReadyEvent ({type}) {
  return has(Object.keys(readyEventMap), type);
}

/*
 * Takes a document, finds its doc shell tree root and returns the
 * matching Page instance if found
 */
function pageFromDoc(doc) {
  let rootWindow = getDocShellTreeItem(doc.defaultView), page;
  if (!rootWindow) return;

  let frames = rootWindow.document.getElementsByTagName('iframe');
  for (let i = frames.length; i--;)
    if (frames[i].contentDocument === doc && (page = pageFor(frames[i])))
      return page;
  return null;
}
