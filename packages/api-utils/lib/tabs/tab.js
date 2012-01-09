/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Ci } = require('chrome');
const { Trait } = require("../traits");
const { EventEmitter } = require("../events");
const { validateOptions } = require("../api-utils");
const { Enqueued } = require("../utils/function");
const { EVENTS } = require("./events");
const { getThumbnailURIForWindow } = require("../utils/thumbnail");
const { getFaviconURIForLocation } = require("../utils/data");



// Array of the inner instances of all the wrapped tabs.
const TABS = [];

/**
 * Trait used to create tab wrappers.
 */
const TabTrait = Trait.compose(EventEmitter, {
  on: Trait.required,
  _emit: Trait.required,
  /**
   * Tab DOM element that is being wrapped.
   */
  _tab: null,
  /**
   * Window wrapper whose tab this object represents.
   */
  window: null,
  constructor: function Tab(options) {
    this._onReady = this._onReady.bind(this);
    this._tab = options.tab;
    let window = this.window = options.window;
    // Setting event listener if was passed.
    for each (let type in EVENTS) {
      let listener = options[type.listener];
      if (listener)
        this.on(type.name, options[type.listener]);
      if ('ready' != type.name) // window spreads this event.
        window.tabs.on(type.name, this._onEvent.bind(this, type.name));
    }

    this.on(EVENTS.close.name, this.destroy.bind(this));
    this._browser.addEventListener(EVENTS.ready.dom, this._onReady, true);

    if (options.isPinned)
      this.pin();

    // Since we will have to identify tabs by a DOM elements facade function
    // is used as constructor that collects all the instances and makes sure
    // that they more then one wrapper is not created per tab.
    return this;
  },
  destroy: function destroy() {
    this._removeAllListeners();
    this._browser.removeEventListener(EVENTS.ready.dom, this._onReady,
                                            true);
  },

  /**
   * Internal listener that emits public event 'ready' when the page of this
   * tab is loaded.
   */
  _onReady: function _onReady(event) {
    // IFrames events will bubble so we need to ignore those.
    if (event.target == this._contentDocument)
      this._emit(EVENTS.ready.name, this._public);
  },
  /**
   * Internal tab event router. Window will emit tab related events for all it's
   * tabs, this listener will propagate all the events for this tab to it's
   * listeners.
   */
  _onEvent: function _onEvent(type, tab) {
    if (tab == this._public)
      this._emit(type, tab);
  },
  /**
   * Browser DOM element where page of this tab is currently loaded.
   */
  get _browser() this._window.gBrowser.getBrowserForTab(this._tab),
  /**
   * Window DOM element containing this tab.
   */
  get _window() this._tab.ownerDocument.defaultView,
  /**
   * Document object of the page that is currently loaded in this tab.
   */
  get _contentDocument() this._browser.contentDocument,
  /**
   * Window object of the page that is currently loaded in this tab.
   */
  get _contentWindow() this._browser.contentWindow,

  /**
   * The title of the page currently loaded in the tab.
   * Changing this property changes an actual title.
   * @type {String}
   */
  get title() this._contentDocument.title,
  set title(value) this._contentDocument.title = String(value),
  /**
   * Location of the page currently loaded in this tab.
   * Changing this property will loads page under under the specified location.
   * @type {String}
   */
  get url() String(this._browser.currentURI.spec),
  set url(value) this._changeLocation(String(value)),
  // "TabOpen" event is fired when it's still "about:blank" is loaded in the
  // changing `location` property of the `contentDocument` has no effect since
  // seems to be either ignored or overridden by internal listener, there for
  // location change is enqueued for the next turn of event loop.
  _changeLocation: Enqueued(function(url) this._browser.loadURI(url)),
  /**
   * URI of the favicon for the page currently loaded in this tab.
   * @type {String}
   */
  get favicon() getFaviconURIForLocation(this.url),
  /**
   * The CSS style for the tab
   */
  get style() null, // TODO
  /**
   * The index of the tab relative to other tabs in the application window.
   * Changing this property will change order of the actual position of the tab.
   * @type {Number}
   */
  get index()
    this._window.gBrowser.getBrowserIndexForDocument(this._contentDocument),
  set index(value) this._window.gBrowser.moveTabTo(this._tab, value),
  /**
   * Thumbnail data URI of the page currently loaded in this tab.
   * @type {String}
   */
  getThumbnail: function getThumbnail()
    getThumbnailURIForWindow(this._contentWindow),
  /**
   * Whether or not tab is pinned (Is an app-tab).
   * @type {Boolean}
   */
  get isPinned() this._tab.pinned,
  pin: function pin() {
    this._window.gBrowser.pinTab(this._tab);
  },
  unpin: function unpin() {
    this._window.gBrowser.unpinTab(this._tab);
  },
  
  /**
   * Create a worker for this tab, first argument is options given to Worker.
   * @type {Worker}
   */
  attach: function attach(options) {
    let { Worker } = require("../content/worker");
    options.window = this._contentWindow;
    let worker = Worker(options);
    worker.once("detach", function detach() {
      worker.destroy();
    });
    return worker;
  },
  
  /**
   * Make this tab active.
   * Please note: That this function is called synchronous since in E10S that
   * will be the case. Besides this function is called from a constructor where
   * we would like to return instance before firing a 'TabActivated' event.
   */
  activate: Enqueued(function activate() {
    if (this._window) // Ignore if window is closed by the time this is invoked.
      this._window.gBrowser.selectedTab = this._tab;
  }),
  /**
   * Close the tab
   */
  close: function close(callback) {
    if (callback)
      this.once(EVENTS.close.name, callback);
    this._window.gBrowser.removeTab(this._tab);
  },
  /**
   * Reload the tab
   */
  reload: function reload() {
    this._window.gBrowser.reloadTab(this._tab);
  }
});

function Tab(options) {
  let chromeTab = options.tab;
  for each (let tab in TABS) {
    if (chromeTab == tab._tab)
      return tab._public;
  }
  let tab = TabTrait(options);
  TABS.push(tab);
  return tab._public;
}
Tab.prototype = TabTrait.prototype;
exports.Tab = Tab;

function Options(options) {
  if ("string" === typeof options)
    options = { url: options };

  return validateOptions(options, {
    url: { is: ["string"] },
    inBackground: { is: ["undefined", "boolean"] },
    isPinned: { is: ["undefined", "boolean"] },
    onOpen: { is: ["undefined", "function"] },
    onClose: { is: ["undefined", "function"] },
    onReady: { is: ["undefined", "function"] },
    onActivate: { is: ["undefined", "function"] },
    onDeactivate: { is: ["undefined", "function"] }
  });
}
exports.Options = Options;


exports.getTabForWindow = function (win) {
  // Get browser window
  let topWindow = win.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIWebNavigation)
                     .QueryInterface(Ci.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindow);
  if (!topWindow.gBrowser) return null;
  
  // Get top window object, in case we are in a content iframe
  let topContentWindow;
  try {
    topContentWindow = win.top;
  } catch(e) {
    // It may throw if win is not a valid content window
    return null;
  }
  
  function getWindowID(obj) {
    return obj.QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowUtils)
              .currentInnerWindowID;
  }
  
  // Search for related Tab
  let topWindowId = getWindowID(topContentWindow);
  for (let i = 0; i < topWindow.gBrowser.browsers.length; i++) {
    let w = topWindow.gBrowser.browsers[i].contentWindow;
    if (getWindowID(w) == topWindowId) {
      return Tab({
        // TODO: api-utils should not depend on addon-kit!
        window: require("addon-kit/windows").BrowserWindow({ window: topWindow }),
        tab: topWindow.gBrowser.tabs[i]
      });
    }
  }
  
  // We were unable to find the related tab!
  return null;
}
