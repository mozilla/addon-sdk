/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'experimental',
  'engines': {
    'Firefox': '*'
  }
};

const { Class } = require('../core/heritage');
const { merge } = require('../util/object');
const { Disposable } = require('../core/disposable');
const { off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');
const { URL } = require('../url');
const { add, remove, has, clear, iterator } = require('../lang/weak-set');
const { WindowTracker } = require('../deprecated/window-utils');
const { create, dispose } = require('./sidebar/utils');
const { isBrowser, getMostRecentBrowserWindow, windows } = require('../window/utils');
const { ns } = require('../core/namespace');
const { remove: removeFromArray } = require('../util/array');
const { show, hide } = require('./sidebar/actions');
const { isShowing } = require('./sidebar/state');
const { Worker: WorkerTrait } = require('../content/worker');
const { contract } = require('./sidebar/contract');

const Worker = WorkerTrait.resolve({
  _injectInDocument: '__injectInDocument'
}).compose({
  get _injectInDocument() true
});

const sidebarNS = ns();

const WEB_PANEL_BROWSER_ID = 'web-panels-browser';

let sidebars = {};
let models = new WeakMap();
let views = new WeakMap();

function viewsFor(sidebar) views.get(sidebar);
function modelFor(sidebar) models.get(sidebar);

const Sidebar = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    let self = this;

    const windowNS = ns();

    let model = merge({}, contract(options));

    models.set(this, model);

    setListeners(this, options);

    let bars = [];
    sidebarNS(self).tracker = WindowTracker({
      onTrack: function(window) {
        if (!isBrowser(window))
          return;

        let sidebar = window.document.getElementById('sidebar');
        let sidebarBox = window.document.getElementById('sidebar-box');

        let bar = create(window, {
          id: makeID(model.id),
          title: model.title,
          sidebarurl: model.url
        });
        bars.push(bar);
        windowNS(window).bar = bar;

        function onSidebarLoad() {
          // check if the sidebar is ready
          let isReady = sidebar.docShell && sidebar.contentDocument;
          if (!isReady)
            return;

          // check if it is a web panel
          let panelBrowser = sidebar.contentDocument.getElementById(WEB_PANEL_BROWSER_ID);
          if (!panelBrowser) {
            bar.removeAttribute('checked');
            return;
          }

          let sbTitle = window.document.getElementById('sidebar-title');
          function onWebPanelSidebarLoad() {
            if (panelBrowser.contentWindow.location != model.url ||
                sbTitle.value != model.title) {
              return;
            }

            let worker = windowNS(window).worker = Worker({
              window: panelBrowser.contentWindow
            });

            function onWebPanelSidebarUnload() {
              panelBrowser.removeEventListener('unload', onWebPanelSidebarUnload, true);

              windowNS(window).onWebPanelSidebarLoad = null;

              // uncheck the associated menuitem
              bar.setAttribute('checked', 'false');

              emit(self, 'hide', null);
              emit(self, 'detach', worker);
            }
            windowNS(window).onWebPanelSidebarUnload = onWebPanelSidebarUnload;
            panelBrowser.contentWindow.addEventListener('unload', onWebPanelSidebarUnload, false);

            // check the associated menuitem
            bar.setAttribute('checked', 'true');

            emit(self, 'show', null);
            emit(self, 'attach', worker);
          }
          windowNS(window).onWebPanelSidebarLoad = onWebPanelSidebarLoad;
          panelBrowser.addEventListener('DOMWindowCreated', onWebPanelSidebarLoad, true);
        }
        windowNS(window).onSidebarLoad = onSidebarLoad;
        sidebar.addEventListener('load', onSidebarLoad, true);
      },
      onUntrack: function(window) {
        if (!isBrowser(window))
          return;

        let { bar } = windowNS(window);
        if (!bar)
          return;

        removeFromArray(viewsFor(self), bar);

        dispose(bar);

        let sidebar = window.document.getElementById('sidebar');
        if (!sidebar)
          return;

        if (windowNS(window).onSidebarLoad) {
          sidebar.removeEventListener('load', windowNS(window).onSidebarLoad, true)
          windowNS(window).onSidebarLoad = null;
        };

        if (windowNS(window).onWebPanelSidebarLoad) {
          let webPanel = sidebar.contentDocument.getElementById(WEB_PANEL_BROWSER_ID);
          webPanel && webPanel.removeEventListener('DOMWindowCreated', windowNS(window).onWebPanelSidebarLoad, true);
          windowNS(window).onWebPanelSidebarLoad = null;
        }

        if (windowNS(window).onWebPanelSidebarUnload) {
          windowNS(window).onWebPanelSidebarUnload();
        }
      }
    });

    views.set(this, bars);

    add(sidebars, this);
  },
  get id() modelFor(this).id,
  get title() modelFor(this).title,
  get url() modelFor(this).url,
  show: function() show(this),
  hide: function() hide(this),
  dispose: function() {
    off(this);

    let wins = windows('navigator:browser', { includePrivate: true });
    for each (let win in wins) {
      hideSidebar(win, this);
    }

    remove(sidebars, this);

    // stop tracking windows
    sidebarNS(this).tracker.unload();
    sidebarNS(this).tracker = null;

    views.delete(this);
  }
});
exports.Sidebar = Sidebar;

show.define(Sidebar, function(sidebar) {
  let model = modelFor(sidebar);
  let window = getMostRecentBrowserWindow();
  let menuitem = window.document.getElementById(makeID(model.id));
  window.openWebPanel(model.title, model.url);
  menuitem.setAttribute('checked', true);
});

function hideSidebar(window, sidebar) {
  window = window || getMostRecentBrowserWindow();

  if (!isSidebarShowing(window, sidebar))
    return;

  // Below was taken from http://mxr.mozilla.org/mozilla-central/source/browser/base/content/browser.js#4775
  let { document } = window;
  let sidebar = document.getElementById('sidebar');
  let sidebarTitle = document.getElementById('sidebar-title');
  let sidebarBox = document.getElementById('sidebar-box');
  let sidebarSplitter = document.getElementById('sidebar-splitter');
  let commandID = sidebarBox.getAttribute('sidebarcommand');
  let sidebarBroadcaster = document.getElementById(commandID);

  sidebarBox.hidden = true;
  sidebarSplitter.hidden = true;

  sidebar.setAttribute('src', 'about:blank');
  //sidebar.docShell.createAboutBlankContentViewer(null);

  sidebarBroadcaster.removeAttribute('checked');
  sidebarBox.setAttribute('sidebarcommand', '');
  sidebarTitle.value = '';
  sidebarBox.hidden = true;
  sidebarSplitter.hidden = true;
  window.gBrowser.selectedBrowser.focus();
}
hide.define(Sidebar, hideSidebar.bind(null, null));

function isSidebarShowing(window, sidebar) {
  let win = window || getMostRecentBrowserWindow();

  // make sure there is a window
  if (!win) {
    return false;
  }

  // make sure there is a sidebar for the window
  let sb = win.document.getElementById('sidebar');
  let sidebarTitle = win.document.getElementById('sidebar-title');
  if (!(sb && sidebarTitle)) {
    return false;
  }

  // checks if the sidebar box is hidden
  let sbb = win.document.getElementById('sidebar-box');
  if (!sbb || sbb.hidden) {
    return false;
  }

  // checks if the sidebar is loading
  if (win.gWebPanelURI == modelFor(sidebar).url) {
    return false;
  }

  if (sidebarTitle.value == modelFor(sidebar).title) {
    // checks if the sidebar loaded already
    let ele = sb.contentDocument && sb.contentDocument.getElementById(WEB_PANEL_BROWSER_ID);

    if (ele.getAttribute('cachedurl') ==  modelFor(sidebar).url) {
      return true;
    }

    if (ele && ele.contentWindow && ele.contentWindow.location == modelFor(sidebar).url) {
      return true;
    }
  }

  // default
  return false;
}
isShowing.define(Sidebar, isSidebarShowing.bind(null, null));

function makeID(id) {
  return 'jetpack-sidebar-' + id;
}
