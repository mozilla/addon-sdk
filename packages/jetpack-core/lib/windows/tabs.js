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

const { Cc, Ci, Cu } = require("chrome");
const { Trait } = require("traits");
const { List } = require("list");

const ON_READY = "DOMContentLoaded";
const DOM_TAB_OPEN = "TabOpen";
const DOM_TAB_CLOSE = "TabClose";
const ON_TAB_OPEN = "TabOpen";
const ON_TAB_CLOSE = "TabClose";
const TAB_BROWSER = "tabbrowser";
const DEF_FAVICON = "chrome://mozapps/skin/places/defaultFavicon.png"
const DATA_PNG_B64 = "data:image/png;base64,";

let NetUtil = {};
Cu.import("resource://gre/modules/NetUtil.jsm", NetUtil);
NetUtil = NetUtil.NetUtil;
const FaveiconService = Cc["@mozilla.org/browser/favicon-service;1"].
                          getService(Ci.nsIFaviconService);

const TabList = List.resolve({ constructor: "_init" }).compose(
  Trait.compose({
    constructor: function TabList(window) {
      window.on(ON_TAB_OPEN, this._add.bind(this));
      window.on(ON_TAB_CLOSE, this._remove.bind(this));
      this._init();
    }
  }).resolve({ toString: null })
);

const WindowTabTracker = Trait.compose({
  _window: Trait.required,
  _onReady: Trait.required,
  _emit: Trait.required,
  get _tabContainers()
    Array.slice(this._window.document.getElementsByTagName(TAB_BROWSER))
      .map(function(tabBrowser) tabBrowser.tabContainer),
  _initWindowTabTracker: function _initWindowTabTracker() {
    this.tabs;
    // Binding event listeners to the instance.
    this._onTabOpen = this._onTabOpen.bind(this);
    this._onTabClose = this._onTabClose.bind(this);
    let firstTab = null;
    // Some XULRunner apps may have more then one tab browser.
    for each (let tabContainer in this._tabContainers) {
      //
      let tabs = Array.slice(tabContainer.children);
      for each (let tab in tabs) {
        firstTab = firstTab || tab;
        this._onTabOpen({ target: tab })
      }
      // Setting event listeners to track opennig / closing tabs.
      tabContainer.addEventListener(DOM_TAB_OPEN, this._onTabOpen, true);
      tabContainer.addEventListener(DOM_TAB_CLOSE, this._onTabClose, true);
    }
    let gBrowser = this._window.gBrowser;
    let tab = gBrowser.getBrowserForTab(firstTab);
    let listener = this.__onReady = this.__onReady.bind(this, tab)
    tab.addEventListener(ON_READY, listener, false);
  },
  __onReady: function __onReady(tab, e) {
    tab.removeEventListener(ON_READY, this.__onReady, false);
    this._onReady(e);
  },
  _onTabOpen: function _onTabOpen(event) {
    this._emit(ON_TAB_OPEN, Tab({ tab: event.target }));
  },
  _onTabClose: function _onTabClose(event) {
    this._emit(ON_TAB_CLOSE, Tab({ tab: event.target }));
  }
});
exports.WindowTabTracker = WindowTabTracker;

const WindowTabs = Trait.compose(
  WindowTabTracker,
  Trait.compose({
    _window: Trait.required,
    get tabs() {
      return this._tabs || (this._tabs = TabList(this._public))
    },
    _tabs: null
  })
)
exports.WindowTabs = WindowTabs;


const TabTrait = Trait.compose({
  _tab: null,

  constructor: function Tab(options) {
    this._tab = options.tab;
    // listen for events, filtered on this tab
    // eventsTabDelegate.addTabDelegate(this);
    return this;
  },

  get _browser() this._window.gBrowser.getBrowserForTab(this._tab),
  get _window() this._tab.ownerDocument.defaultView,
  get _contentDocument() this._browser.contentDocument,
  get _contentWindow() this._browser.contentWindow,

  // Non i10s compatible and will go away soon.
  get contentDocument() this._contentDocument,
  get contentWindow() this._contentWindow,

  get title() this._contentDocument.title,
  get location() this._contentDocument.location,
  get faveicon() {
    let pageURI = NetUtil.newURI(this.location);
    let faviconURL;
    try {
      let faviconURI = FaveiconService.getFaviconForPage(pageURI);
      faviconURL = FaveiconService.getFaviconDataAsDataURL(faviconURI);
    } catch(ex) {
      let data = getChromeURLContents(DEF_FAVICON);
      let encoded = this._contentWindow.btoa(data);
      faviconURL = DATA_PNG_B64 + encoded;
    }
    return faviconURL;
  },
  get style() null, // TODO
  get index()
    this._window.gBrowser.getBrowserIndexForDocument(this._contentDocument),
  get thumbnail()
    getThumbnailCanvasForTab(this._tab, this._contentWindow),
  get isPinned() this._tab.pinned,

  pin: function pin() {
    this._window.gBrowser.pinTab(this._tab);
    return this._public;
  },
  unpin: function unpin() {
    this._window.gBrowser.unpinTab(this._tab)
    return this._public;
  },
  focus: function focus() {
    let window = this._window;
    window.focus();
    window.gBrowser.selectedTab = this._tab;
    return this._public;
  },
  move: function move(index) {
    this._window.gBrowser.moveTabTo(this._tab, index);
    return this._public;
  }
});

const TABS = []
function Tab(options) {
  let chromeTab = options.tab;
  for each (let tab in TABS) {
    if (chromeTab == tab._tab)
      return tab._public
  }
  let tab = TabTrait(options);
  TABS.push(tab);
  return tab._public;
}
Tab.prototype = TabTrait.prototype
exports.Tab = Tab
