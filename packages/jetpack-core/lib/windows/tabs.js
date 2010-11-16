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
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

const { Trait } = require("traits");
const { List } = require("list");
const { Tab, Options } = require("tabs/tab");
const { EventEmitter } = require("events");
const { EVENTS } = require("tabs/events");

const TAB_BROWSER = "tabbrowser";

const WindowTabTracker = Trait.compose({
  /**
   * Chrome window whose tabs are tracked.
   */
  _window: Trait.required,
  /**
   * Function used to emit events.
   */
  _emit: Trait.required,
  _tabOptions: Trait.required,
  /**
   * Function to add event listeners.
   */
  on: Trait.required,
  /**
   * Live array of the window tabContainers.
   */
  get _tabContainers()
    Array.slice(this._window.document.getElementsByTagName(TAB_BROWSER))
      .map(function(tabBrowser) tabBrowser.tabContainer),
  /**
   * Initializes tab tracker.
   */
  _initWindowTabTracker: function _initWindowTabTracker() {
    this.tabs;
    // Some XULRunner apps may have more then one tab browser.
    for each (let tabContainer in this._tabContainers) {
      let tabs = Array.slice(tabContainer.children);
      // Emulating 'open' events for all open tabs.
      for each (let tab in tabs)
        this._onTabEvent(EVENTS.open.window, { target: tab })
      this._onTabEvent(EVENTS.activate.window, { target: this._window.gBrowser.selectedTab })
      // Setting event listeners to track tab events
      for each (let type in EVENTS) {
        if (!type.dom) continue;
        tabContainer.addEventListener(type.dom,
                                      this._onTabEvent.bind(this, type.window),
                                      false);
      }
    }
    this.on('close', this._destroyTabTracker.bind(this));
  },
  _destroyTabTracker: function() {
    for each (tab in this.tabs)
      tab.close();
    this._tabs._clear();
  },
  _onTabEvent: function _onTabEvent(type, event) {
    let options = this._tabOptions.shift() || {};
    options.tab = event.target;
    options.window = this._public;
    var tab = Tab(options);
    if (type == EVENTS.open.dom)
      tab.on(EVENTS.ready.tab, this._emitEvent.bind(this, EVENTS.ready.window));
    this._emitEvent(type, tab);
  },
  _emitEvent: function _emitEvent(type, tab) {
    // Notifies combined tab list that tab was added / removed.
    tabs._emit(type, tab);
    // Notifies contained tab list that window was added / removed.
    this._tabs._emit(type, tab);
    // Notifies listeners that tab got opened / closed / selected.
    this._emit(type, tab);
  }
});
exports.WindowTabTracker = WindowTabTracker;

const TabList = List.resolve({ constructor: "_init" }).compose(
  EventEmitter.resolve({ toString: null }),
  Trait.compose({
    on: Trait.required,
    _emit: Trait.required,
    constructor: function TabList() {
      this.on('error', this._onError = this._onError.bind(this));
      // Add new items to the list
      this.on(EVENTS.open.window, this._add.bind(this));
      // Remove closed items from the list
      this.on(EVENTS.close.window, this._remove.bind(this));
      // Emit events for closed items
      this.on(EVENTS.activate.window, this._onActivate.bind(this));
      this._init();
      return this;
    }
    _onActivate: function _onActivate(value) {
      this._emit(EVENTS.deactivate.window, this._active);
      this._active = value;
    },
    _onError: function _onError(error) {
      if (1 <= this._listeners('error').length)
        console.exception(error)
    },
  }).resolve({ toString: null })
);

// Combined list of tabs for all the windows.
var tabs = TabList();
exports.tabs = tabs._public;

const WindowTabs = Trait.compose(
  WindowTabTracker,
  Trait.compose({
    _window: Trait.required,
    get tabs() {
      return (this._tabs || (this._tabs = TabList()))._public
    },
    _tabs: null,

    get activeTab()
      Tab({ tab: this._window.gBrowser.selectedTab, window: this._public }),
    set activeTab(value) value.focus()
  })
);
exports.WindowTabs = WindowTabs;
