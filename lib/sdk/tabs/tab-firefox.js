/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Class } = require("../core/heritage");
const { Disposable } = require("../core/disposable");
const { EventTarget } = require("../event/target");
const { emit, on, off, setListeners } = require("../event/core");
const { defer, compose } = require("../lang/functional");
const { EVENTS } = require("./events");
const { ns } = require("../core/namespace");
const { getThumbnailURIForWindow } = require("../content/thumbnail");
const { getFaviconURIForLocation } = require("../io/data");
const { activateTab, getOwnerWindow, getBrowserForTab, getTabTitle,
        setTabTitle, getTabURL, setTabURL, getTabContentType,
        getTabBrowserForTab } = require('./utils');

// Array of the inner instances of all the wrapped tabs.
const wrappers = WeakMap();
const views = WeakMap();

function getView(wrapper) views.get(wrapper)
function getWrapper(tab) wrappers.get(tab)
function isPinned(tab) tab.pinned
function getContentDocument(tab) getBrowserForTab(tab).contentDocument
function getContentWindow(tab) getBrowserForTab(tab).contentWindow
function moveTab(tab, index) getTabBrowserForTab(tab).moveTabTo(tab, index)
function pin(tab) getTabBrowserForTab(tab).pinTab(tab)
function unpin(tab) getTabBrowserForTab(tab).unpinTab(tab)
function close(tab) getTabBrowserForTab(tab).removeTab(tab)
function reload(tab) getTabBrowserForTab(tab).reloadTab(tab)
function getTabIndex(tab) {
  return getTabBrowserForTab(tab).
         getBrowserIndexForDocument(getContentDocument(tab));
}

function method(f) {
  return function() f.apply(f, [views.get(this)].concat(Array.slice(arguments)))
}

let getBrowser = compose(getTabBrowserForTab, getView)

const TabAccessors = Object.defineProperties({}, {
  title: {
    get: method(getTabTitle),
    set: method(setTabTitle)
  },
  contentType: {
    get: method(getTabContentType)
  },
  url: {
    get: method(getTabURL),
    set: method(setTabURL)
  },
  favicon: {
    get: method(compose(getFaviconURIForLocation, getTabURL))
  },
  index: {
    get: method(getTabIndex),
    set: method(moveTab)
  },
  isPinned: {
    get: method(isPinned),
  }
});

// FIXING:
// Bug 821536 - Tab title changes are not reflected


/**
 * Trait used to create tab wrappers.
 */
const TabType = Class({
  implements: [Disposable, TabAccessors],
  extends: EventTarget,
  setup: function setup(options) {
    let view = options.tab;
    if (wrappers.has(view)) return wrappers.get(view);

    views.set(this, view);
    wrappers.set(view, this);

    let window = options.window || getOwnerWindow(view);
    let browser = getBrowserForTab(view);

    setListeners(this, options);

    if (options.isPinned) pin(view);
  },
  handleEvent: function handleEvent({ type, target }) {
    // IFrames events will bubble so we ignore those.
    if (type === EVENTS.ready.dom && target === getContentDocument(this))
      emit(this, EVENTS.ready.name, this);
  },

  get style() null, // TODO
  getThumbnail: method(compose(getThumbnailURIForWindow, getContentWindow)),
  pin: method(pin),
  unpin: method(unpin),
  activate: method(defer(activateTab)),
  reload: method(reload),

  /**
   * Create a worker for this tab, first argument is options given to Worker.
   * @type {Worker}
   */
  attach: function(options) {
    // BUG 792946 https://bugzilla.mozilla.org/show_bug.cgi?id=792946
    // TODO: fix this circular dependency
    let { view } = tab(this);
    let { Worker, attach } = require('./worker/utils');
    let worker = Worker(options);
    attach(worker, getContentDocument(view).defaultView);
    return worker;
  },
  close: function(callback) {
    if (callback) this.once("close", callback);
    close(tab(this).view);
  }
});

function Tab(options) {
  options = options || {};
  if (wrappers.has(options.tab)) return wrappers.get(options.tab);
  if (this instanceof Tab) this.initialize(options);
  else return new Tab(options);
}
Tab.prototype = TabType.prototype;

exports.Tab = Tab;
