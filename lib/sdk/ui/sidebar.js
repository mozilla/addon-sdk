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
const { create, dispose, isShowing } = require('./sidebar/utils');
const { isBrowser, getMostRecentBrowserWindow, windows } = require('../window/utils');
const { ns } = require('../core/namespace');
const { remove: removeFromArray } = require('../util/array');
const { show, hide, toggle } = require('./sidebar/actions');
const { Worker: WorkerTrait } = require('../content/worker');
const { contract: sidebarContract } = require('./sidebar/contract');
const { Button } = require('./button');
const { setChecked } = require('./button/view');
const { defer } = require('../core/promise');

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
let buttons = new WeakMap();

function viewsFor(sidebar) views.get(sidebar);
function modelFor(sidebar) models.get(sidebar);

const Sidebar = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    let self = this;

    const windowNS = ns();

    let model = sidebarContract(options);

    models.set(this, model);

    setListeners(this, options);

    function updateButtonState(source, state) {
      let wins = windows('navigator:browser', { includePrivate: true });
      for (let window of wins) {
        let isShowing = isSidebarShowing(window, self);
        let isChecked = (source == 'button') ? state.checked : isShowing;

        // update sidebar?
        if (isShowing != isChecked) {
          if (isChecked) {
            showSidebar(window, self);
          }
          else {
            hideSidebar(window, self);
          }
        }

        // update the button
        setChecked(button, window, isChecked);
      }
    }
    let button = Button({
      id: model.id,
      icon: model.icon,
      label: model.title,
      type: 'checkbox',
      onChange: updateButtonState.bind(null, 'button')
    });
    buttons.set(this, button);

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

        bar.addEventListener('command', function() {
          if (isSidebarShowing(window, self)) {
            hideSidebar(window, self);
            return;
          }

          showSidebar(window, self);
        }, false);

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
          function onWebPanelSidebarCreated() {
            if (panelBrowser.contentWindow.location != model.url ||
                sbTitle.value != model.title) {
              return;
            }

            let worker = windowNS(window).worker = Worker({
              window: panelBrowser.contentWindow
            });

            function onWebPanelSidebarUnload() {
              panelBrowser.removeEventListener('unload', onWebPanelSidebarUnload, false);

              windowNS(window).onWebPanelSidebarUnload = null;

              // uncheck the associated menuitem
              bar.setAttribute('checked', 'false');
              updateButtonState();

              emit(self, 'hide', null);
              emit(self, 'detach', worker);
            }
            windowNS(window).onWebPanelSidebarUnload = onWebPanelSidebarUnload;
            panelBrowser.contentWindow.addEventListener('unload', onWebPanelSidebarUnload, false);

            // check the associated menuitem
            bar.setAttribute('checked', 'true');

            function onWebPanelSidebarLoad() {
              panelBrowser.removeEventListener('load', onWebPanelSidebarLoad, true);

              windowNS(window).onWebPanelSidebarLoad = null;

              updateButtonState();

              emit(self, 'show', { worker: worker });
            }
            windowNS(window).onWebPanelSidebarLoad = onWebPanelSidebarLoad;
            panelBrowser.contentWindow.addEventListener('load', onWebPanelSidebarLoad, true);

            emit(self, 'attach', worker);
          }
          windowNS(window).onWebPanelSidebarCreated = onWebPanelSidebarCreated;
          panelBrowser.addEventListener('DOMWindowCreated', onWebPanelSidebarCreated, true);
        }
        windowNS(window).onSidebarLoad = onSidebarLoad;
        sidebar.addEventListener('load', onSidebarLoad, true);
      },
      onUntrack: function(window) {
        if (!isBrowser(window))
          return;

        let { bar } = windowNS(window);
        if (bar) {
          removeFromArray(viewsFor(self), bar);
          dispose(bar);
        }

        let sidebar = window.document.getElementById('sidebar');
        if (!sidebar)
          return;

        if (windowNS(window).onSidebarLoad) {
          sidebar.removeEventListener('load', windowNS(window).onSidebarLoad, true)
          windowNS(window).onSidebarLoad = null;
        }

        if (windowNS(window).onWebPanelSidebarCreated) {
          let webPanel = sidebar.contentDocument.getElementById(WEB_PANEL_BROWSER_ID);
          webPanel && webPanel.removeEventListener('DOMWindowCreated', windowNS(window).onWebPanelSidebarCreated, true);
          windowNS(window).onWebPanelSidebarCreated = null;
        }

        if (windowNS(window).onWebPanelSidebarLoad) {
          windowNS(window).onWebPanelSidebarLoad();
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
  show: function() {
    let { promise, resolve } = defer();
    this.once('show', resolve);
    show(this);
    return promise;
  },
  hide: function() {
    let { promise, resolve } = defer();
    this.once('hide', resolve);
    hide(this);
    return promise;
  },
  dispose: function() {
    off(this);

    let wins = windows('navigator:browser', { includePrivate: true });
    for (let win of wins) {
      hideSidebar(win, this);
    }

    remove(sidebars, this);

    // stop tracking windows
    sidebarNS(this).tracker.unload();
    sidebarNS(this).tracker = null;

    views.delete(this);

    // kill the button
    let button = buttons.get(this);
    if (button)
      button.destroy();
  }
});
exports.Sidebar = Sidebar;

function showSidebar(window, sidebar) {
  let model = modelFor(sidebar);
  let window = window || getMostRecentBrowserWindow();

  window.openWebPanel(model.title, model.url);

  let menuitem = window.document.getElementById(makeID(model.id));
  menuitem.setAttribute('checked', true);
}
show.define(Sidebar, showSidebar.bind(null, null));

function hideSidebar(window, sidebar) {
  window = window || getMostRecentBrowserWindow();

  if (!isSidebarShowing(window, sidebar))
    return;

  // return window.toggleSidebar();

  // Below was taken from http://mxr.mozilla.org/mozilla-central/source/browser/base/content/browser.js#4775
  // the code for window.todggleSideBar()..
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

  // TODO: perhaps this isn't necessary if the window is not most recent?
  window.gBrowser.selectedBrowser.focus();
}
hide.define(Sidebar, hideSidebar.bind(null, null));

function toggleSidebar(window, sidebar) {
  window = window || getMostRecentBrowserWindow();
  if (isSidebarShowing(window, sidebar)) {
    hideSidebar(window, sidebar);
  }
  else {
    showSidebar(window, sidebar);
  }
}
toggle.define(Sidebar, toggleSidebar.bind(null, null));

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
    if (!ele) {
      return false;
    }

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
