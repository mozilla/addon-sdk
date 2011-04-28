/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Felipe Gomes <felipc@gmail.com> (Original author)
 *   Irakli Gozalishvili <gozala@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
"use strict";

if (!require("xul-app").is("Firefox")) {
  throw new Error([
    "The windows module currently supports only Firefox. In the future",
    " we would like it to support other applications, however.  Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=571449 for more information."
  ].join(""));
}

const { Cc, Ci } = require('chrome'),
      { Trait } = require('traits'),
      { List } = require('list'),
      { EventEmitter } = require('events'),
      { WindowTabs, WindowTabTracker } = require('windows/tabs'),
      { WindowDom } = require('windows/dom'),
      { WindowLoader } = require('windows/loader'),
      { WindowTrackerTrait } = require('window-utils'),
      { Options } = require('tabs/tab'),
      // { Sidebars } = require('window/sidebars');
      { utils } = require('xpcom'),
      apiUtils = require('api-utils'),
      unload = require('unload'),

      WM = Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator),

      BROWSER = 'navigator:browser';

/**
 * Window trait composes safe wrappers for browser window that are E10S
 * compatible.
 */
const BrowserWindowTrait = Trait.compose(
  EventEmitter,
  WindowDom.resolve({ close: '_close' }),
  WindowTabs,
  WindowTabTracker,
  WindowLoader,
  /* WindowSidebars, */
  Trait.compose({
    _emit: Trait.required,
    _close: Trait.required,
    _load: Trait.required,
    /**
     * Constructor returns wrapper of the specified chrome window.
     * @param {nsIWindow} window
     */
    constructor: function BrowserWindow(options) {
      // make sure we don't have unhandled errors
      this.on('error', console.exception.bind(console));

      if ('onOpen' in options)
        this.on('open', options.onOpen);
      if ('onClose' in options)
        this.on('close', options.onClose);
      if ('window' in options)
        this._window = options.window;
      if ('tabs' in options) {
        this._tabOptions = Array.isArray(options.tabs) ?
                           options.tabs.map(Options) :
                           [ Options(options.tabs) ];
      }
      else if ('url' in options) {
        this._tabOptions = [ Options(options.url) ];
      }
      this._load();
      return this;
    },
    _tabOptions: [],
    _onLoad: function() {
      try {
        this._initWindowTabTracker();
      } catch(e) {
        this._emit('error', e)
      }
      this._emitOnObject(browserWindows, 'open', this._public);
    },
    _onUnload: function() {
      this._destroyWindowTabTracker();
      this._emitOnObject(browserWindows, 'close', this._public);
      this._window = null;
      // Removing reference from the windows array.
      windows.splice(windows.indexOf(this), 1);
      this._removeAllListeners('close');
      this._removeAllListeners('open');
      this._removeAllListeners('ready');
    },
    close: function close(callback) {
      // maybe we should deprecate this with message ?
      if (callback) this.on('close', callback);
      return this._close();
    }
  })
);
/**
 * Wrapper for `BrowserWindowTrait`. Creates new instance if wrapper for
 * window doesn't exists yet. If wrapper already exists then returns it
 * instead.
 * @params {Object} options
 *    Options that are passed to the the `BrowserWindowTrait`
 * @returns {BrowserWindow}
 * @see BrowserWindowTrait
 */
function BrowserWindow(options) {
  let chromeWindow = options.window;
  for each (let window in windows) {
    if (chromeWindow == window._window)
      return window._public
  }
  let window = BrowserWindowTrait(options);
  windows.push(window);
  return window._public;
}
// to have proper `instanceof` behavior will go away when #596248 is fixed.
BrowserWindow.prototype = BrowserWindowTrait.prototype;
exports.BrowserWindow = BrowserWindow
const windows = [];
/**
 * `BrowserWindows` trait is composed out of `List` trait and it represents
 * "live" list of currently open browser windows. Instance mutates itself
 * whenever new browser window gets opened / closed.
 */
// Very stupid to resolve all `toStrings` but this will be fixed by #596248
const browserWindows = Trait.resolve({ toString: null }).compose(
  List.resolve({ constructor: '_initList' }),
  EventEmitter.resolve({ toString: null }),
  WindowTrackerTrait.resolve({ constructor: '_initTracker', toString: null }),
  Trait.compose({
    _emit: Trait.required,
    _add: Trait.required,
    _remove: Trait.required,

    // public API

    /**
     * Constructor creates instance of `Windows` that represents live list of open
     * windows.
     */
    constructor: function BrowserWindows() {
      this._trackedWindows = [];
      this._initList();
      this._initTracker();
      unload.ensure(this, "_destructor");
    },
    _destructor: function _destructor() {
      this._removeAllListeners('open');
      this._removeAllListeners('close');
    },
    /**
     * This property represents currently active window.
     * Property is non-enumerable, in order to preserve array like enumeration.
     * @type {Window|null}
     */
    get activeWindow() {
      let window = WM.getMostRecentWindow(BROWSER);
      return this._isBrowser(window) ? BrowserWindow({ window: window }) : null;
    },
    open: function open(options) {
      if (typeof options === "string")
        // `tabs` option is under review and may be removed.
        options = { tabs: [Options(options)] };
      return BrowserWindow(options);
    },
    /**
     * Returns true if specified window is a browser window.
     * @param {nsIWindow} window
     * @returns {Boolean}
     */
    _isBrowser: function _isBrowser(window)
      BROWSER === window.document.documentElement.getAttribute("windowtype")
    ,
     /**
      * Internal listener which is called whenever new window gets open.
      * Creates wrapper and adds to this list.
      * @param {nsIWindow} chromeWindow
      */
    _onTrack: function _onTrack(chromeWindow) {
      if (!this._isBrowser(chromeWindow)) return;
      let window = BrowserWindow({ window: chromeWindow });
      this._add(window);
      this._emit('open', window);
    },
    /**
     * Internal listener which is called whenever window gets closed.
     * Cleans up references and removes wrapper from this list.
     * @param {nsIWindow} window
     */
    _onUntrack: function _onUntrack(chromeWindow) {
      if (!this._isBrowser(chromeWindow)) return;
      let window = BrowserWindow({ window: chromeWindow });
      // `_onUnload` method of the `BrowserWindow` will remove `chromeWindow`
      // from the `windows` array.
      this._remove(window);
      this._emit('close', window);
    }
  }).resolve({ toString: null })
)();
exports.browserWindows = browserWindows;

