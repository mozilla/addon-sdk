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
const { isShowing } = require('./sidebar/utils');
const { isBrowser, getMostRecentBrowserWindow, windows, isWindowPrivate } = require('../window/utils');
const { ns } = require('../core/namespace');
const { remove: removeFromArray } = require('../util/array');
const { show, hide, toggle } = require('./sidebar/actions');
const { Worker: WorkerTrait } = require('../content/worker');
const { contract: sidebarContract } = require('./sidebar/contract');
const { Button } = require('./button');
const { setStateFor, getStateFor } = require('./state');
const { create, dispose, updateTitle, updateURL, isSidebarShowing, showSidebar, hideSidebar } = require('./sidebar/view');
const { defer } = require('../core/promise');
const { models, buttons, views, viewsFor, modelFor } = require('./sidebar/namespace');
const { isLocalURL } = require('../url');

const Worker = WorkerTrait.resolve({
  _injectInDocument: '__injectInDocument'
}).compose({
  get _injectInDocument() true
});

const sidebarNS = ns();

const WEB_PANEL_BROWSER_ID = 'web-panels-browser';

let sidebars = {};

const Sidebar = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    let self = this;

    const windowNS = ns();

    let model = sidebarContract(options);

    models.set(this, model);

    setListeners(this, options);

    function update(source, state) {
      let wins = windows('navigator:browser', { includePrivate: true });
      for (let window of wins) {
        let isShowing = isSidebarShowing(window, self);
        let isChecked = (source == 'button') ? getStateFor(button, window).checked : isShowing;

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
        setStateFor(button, window, { checked: isChecked });
      }
    }
    let button = Button({
      id: model.id,
      icon: model.icon,
      label: model.title,
      type: 'checkbox',
      onChange: update.bind(null, 'button')
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
          id: model.id,
          title: model.title
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
              update();

              emit(self, 'hide', {});
              emit(self, 'detach', worker);
            }
            windowNS(window).onWebPanelSidebarUnload = onWebPanelSidebarUnload;
            panelBrowser.contentWindow.addEventListener('unload', onWebPanelSidebarUnload, false);

            // check the associated menuitem
            bar.setAttribute('checked', 'true');

            function onWebPanelSidebarLoad() {
              panelBrowser.removeEventListener('load', onWebPanelSidebarLoad, true);

              windowNS(window).onWebPanelSidebarLoad = null;

              update();

              // TODO: decide if returning worker is acceptable..
              //emit(self, 'show', { worker: worker });
              emit(self, 'show', {});
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
  set title(v) {
    if (typeof v != 'string')
      throw Error('title must be a string');
    updateTitle(this, v);
    return modelFor(this).title = v;
  },
  get url() modelFor(this).url,
  set url(v) {
    if (!isLocalURL(v))
      throw Error('the url must be a valid local url');

    updateURL(this, v);
    modelFor(this).url = v;
  },
  show: function() {
    return showSidebar(null, this);
  },
  hide: function() {
    return hideSidebar(null, this);
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

show.define(Sidebar, showSidebar.bind(null, null));
hide.define(Sidebar, hideSidebar.bind(null, null));

function toggleSidebar(window, sidebar) {
  window = window || getMostRecentBrowserWindow();
  if (isSidebarShowing(window, sidebar)) {
    return hideSidebar(window, sidebar);
  }
  return showSidebar(window, sidebar);
}
toggle.define(Sidebar, toggleSidebar.bind(null, null));

isShowing.define(Sidebar, isSidebarShowing.bind(null, null));
