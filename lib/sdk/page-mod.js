/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "stable"
};

const observers = require('./system/events');
const { contract: loaderContract } = require('./content/loader');
const { contract } = require('./util/contract');
const { getAttachEventType, WorkerHost } = require('./content/utils');
const { Class } = require('./core/heritage');
const { Disposable } = require('./core/disposable');
const { WeakReference } = require('./core/reference');
const { Worker } = require('./content/worker');
const { EventTarget } = require('./event/target');
const { on, emit, once, setListeners } = require('./event/core');
const { on: domOn, removeListener: domOff } = require('./dom/events');
const { pipe } = require('./event/utils');
const { isRegExp } = require('./lang/type');
const { merge } = require('./util/object');
const { windowIterator } = require('./deprecated/window-utils');
const { isBrowser, getFrames } = require('./window/utils');
const { getTabs, getTabContentWindow, getTabForContentWindow,
        getURI: getTabURI, getTabContentType } = require('./tabs/utils');
const { ignoreWindow } = require('./private-browsing/utils');
const { Style } = require("./stylesheet/style");
const { attach, detach } = require("./content/mod");
const { has, hasAny } = require("./util/array");
const { Rules } = require("./util/rules");
const { List, addListItem, removeListItem } = require('./util/list');
const { when: unload } = require("./system/unload");

// Valid values for `attachTo` option
const VALID_ATTACHTO_OPTIONS = ['existing', 'top', 'frame'];

const pagemods = new Set();
const workers = new WeakMap();
const styles = new WeakMap();
const models = new WeakMap();
let modelFor = (mod) => models.get(mod);
let workerFor = (mod) => workers.get(mod);
let styleFor = (mod) => styles.get(mod);

// Bind observer
observers.on('document-element-inserted', onContentWindow);
unload(() => observers.off('document-element-inserted', onContentWindow));

let isRegExpOrString = (v) => isRegExp(v) || typeof v === 'string';

// Validation Contracts
const modOptions = {
  // contentStyle* / contentScript* are sharing the same validation constraints,
  // so they can be mostly reused, except for the messages.
  contentStyle: merge(Object.create(loaderContract.rules.contentScript), {
    msg: 'The `contentStyle` option must be a string or an array of strings.'
  }),
  contentStyleFile: merge(Object.create(loaderContract.rules.contentScriptFile), {
    msg: 'The `contentStyleFile` option must be a local URL or an array of URLs'
  }),
  include: {  
    is: ['string', 'array', 'regexp', 'object'],
    ok: (rule) => {
      function checkURL(r) {
        if (isRegExpOrString(r))
          return true;
        if (Array.isArray(r) && r.length > 0)
          return r.every(isRegExpOrString);
        return false;
      }

      function checkContentType(r) {
        if (typeof r === 'string')
          return true;
        if (Array.isArray(r) && r.length > 0)
          return r.every((v) => typeof v === 'string')
        return false;
      }

      // If rule is an object check url and contentType
      if (typeof rule === 'object' && !Array.isArray(rule)) {
        if (rule.url && rule.contentType) {
          if (checkURL(rule.url) && checkContentType(rule.contentType)) {
            return true;
          }
          return false;
        }
        return false;
      }
      else {
        if (checkURL(rule))
          return true;
        return false;
      }
    },
    msg: 'The `include` option must always contain atleast one rule as a string, regular expression, an array of strings and regular expressions, or an object with a url and contentType.'
  },
  attachTo: {
    is: ['string', 'array', 'undefined'],
    map: function (attachTo) {
      if (!attachTo) return ['top', 'frame'];
      if (typeof attachTo === 'string') return [attachTo];
      return attachTo;
    },
    ok: function (attachTo) {
      return hasAny(attachTo, ['top', 'frame']) &&
        attachTo.every(has.bind(null, ['top', 'frame', 'existing']));
    },
    msg: 'The `attachTo` option must be a string or an array of strings. ' +
      'The only valid options are "existing", "top" and "frame", and must ' +
      'contain at least "top" or "frame" values.'
  },
};

const modContract = contract(merge({}, loaderContract.rules, modOptions));

/**
 * PageMod constructor (exported below).
 * @constructor
 */
const PageMod = Class({
  implements: [
    modContract.properties(modelFor),
    EventTarget,
    Disposable,
    WeakReference
  ],
  extends: WorkerHost(workerFor),
  setup: function PageMod(options) {
    let mod = this;
    let model = modContract(options);
    models.set(this, model);

    // Set listeners on {PageMod} itself, not the underlying worker,
    // like `onMessage`, as it'll get piped.
    setListeners(this, options);

    if (model.include.url) {
      let url = model.include.url;
      model.include.url = Rules();
      model.include.url.add.apply(model.include.url, [].concat(url));
    }
    else {
      let include = model.include;
      model.include = Rules();
      model.include.add.apply(model.include, [].concat(include));
    }

    if (model.contentStyle || model.contentStyleFile) {
      styles.set(mod, Style({
        uri: model.contentStyleFile,
        source: model.contentStyle
      }));
    }

    pagemods.add(this);

    // `applyOnExistingDocuments` has to be called after `pagemods.add()`
    // otherwise its calls to `onContent` method won't do anything.
    if (has(model.attachTo, 'existing'))
      applyOnExistingDocuments(mod);
  },

  dispose: function() {
    let style = styleFor(this);
    if (style)
      detach(style);

    for (let i in this.include) {
      if (this.include.url) {
        this.include.url.remove(this.include.url[i]);
      }
      else {
        this.include.remove(this.include[i]);
      }
    }

    pagemods.delete(this);
  }
});
exports.PageMod = PageMod;

function onContentWindow({ subject: document }) {
  // Return if we have no pagemods
  if (pagemods.size === 0)
    return;

  let window = document.defaultView;
  // XML documents don't have windows, and we don't yet support them.
  if (!window)
    return;
  // We apply only on documents in tabs of Firefox
  if (!getTabForContentWindow(window))
    return;

  // When the tab is private, only addons with 'private-browsing' flag in
  // their package.json can apply content script to private documents
  if (ignoreWindow(window))
    return;

  for (let pagemod of pagemods) {
    if (pagemod.include.url) {
      if (pagemod.include.url.matchesAny(document.URL) &&
          pagemod.include.contentType === document.contentType)
        onContent(pagemod, window);
    }
    else {
      if (pagemod.include.matchesAny(document.URL))
        onContent(pagemod, window);
    }
  }
}

function applyOnExistingDocuments (mod) {
  // Perform page attribute matching with mod rules.
  function Matches(mod, contextObj, context) {
    let contextURL = null,
        contextContentType = null;
    if (context === 'tab') {
      contextURL = getTabURI(contextObj);
      contextContentType = getTabContentType(contextObj);
    }
    else if (context === 'frame') {
      contextURL = contextObj.location.href;
      contextContentType = contextObject.contentDocument.contentType;
    }

    if (mod.include.url) {
      return (mod.include.url.matchesAny(contextURL) &&
              mod.include.contentType === contextContentType);
    }
    else {
      return mod.include.matchesAny(contextURL);
    }
  }

  getTabs().forEach(tab => {
    // Fake a newly created document
    let window = getTabContentWindow(tab);
    if (has(mod.attachTo, "top") && Matches(mod, tab, 'tab'))
      onContent(mod, window);
    if (has(mod.attachTo, "frame")) {
      getFrames(window).
        filter((iframe) => Matches(mod, frame, 'frame')).
        forEach((frame) => onContent(mod, frame));
    }
  });
}

function createWorker (mod, window) {
  let worker = Worker({
    window: window,
    contentScript: mod.contentScript,
    contentScriptFile: mod.contentScriptFile,
    contentScriptOptions: mod.contentScriptOptions,
    // Bug 980468: Syntax errors from scripts can happen before the worker
    // can set up an error handler. They are per-mod rather than per-worker
    // so are best handled at the mod level.
    onError: (e) => emit(mod, 'error', e)
  });
  workers.set(mod, worker);
  pipe(worker, mod);
  emit(mod, 'attach', worker);
  once(worker, 'detach', function detach() {
    worker.destroy();
  });
}

function onContent (mod, window) {
  // not registered yet
  if (!pagemods.has(mod))
    return;

  let isTopDocument = window.top === window;
  // Is a top level document and `top` is not set, ignore
  if (isTopDocument && !has(mod.attachTo, "top"))
    return;
  // Is a frame document and `frame` is not set, ignore
  if (!isTopDocument && !has(mod.attachTo, "frame"))
    return;

  let style = styleFor(mod);
  if (style)
    attach(style, window);

  // Immediatly evaluate content script if the document state is already
  // matching contentScriptWhen expectations
  if (isMatchingAttachState(mod, window)) {
    createWorker(mod, window);
    return;
  }

  let eventName = getAttachEventType(mod) || 'load';
  domOn(window, eventName, function onReady (e) {
    if (e.target.defaultView !== window)
      return;
    domOff(window, eventName, onReady, true);
    createWorker(mod, window);
  }, true);
}

function isMatchingAttachState (mod, window) {
  let state = window.document.readyState;
  return 'start' === mod.contentScriptWhen ||
      // Is `load` event already dispatched?
      'complete' === state ||
      // Is DOMContentLoaded already dispatched and waiting for it?
      ('ready' === mod.contentScriptWhen && state === 'interactive')
}
