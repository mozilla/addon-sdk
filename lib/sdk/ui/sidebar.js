/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

// The Button module currently supports only Firefox.
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=jetpack-panel-apps
module.metadata = {
  'stability': 'stable',
  'engines': {
    'Firefox': '*'
  }
};

const { Ci } = require('chrome');
const { Class } = require('../core/heritage');
const { merge } = require('../util/object');
const { Disposable } = require('../core/disposable');
const { on, off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');
const systemEvents = require('../system/events');
const { open } = require("../event/dom");
const events = require("../event/utils");
const { isNil, isObject } = require('../lang/type');
const { required } = require('../deprecated/api-utils');
const { URL } = require('../url');
const { add, remove, has, clear, iterator } = require("../lang/weak-set");
const { WindowTracker } = require("../deprecated/window-utils");
const { create, dispose, makeID, observer } = require('./sidebar/utils');
const { isBrowser, getMostRecentBrowserWindow } = require('../window/utils');
const { ns } = require('../core/namespace');
const { remove: removeFromArray } = require('../util/array');
const { when: unload } = require('../system/unload');
const { show, hide } = require('./actions');
const { isShowing } = require('./state');
const { Worker: WorkerTrait } = require('../content/worker');

const Worker = WorkerTrait.resolve({
  _injectInDocument: "__injectInDocument"
}).compose({
  get _injectInDocument() true
});

const sidebarNS = ns();

const WEB_PANEL_BROWSER_ID = 'web-panels-browser';

let string = { is: ['string']};

let contract = require('../util/contract').contract({
  id: required(string),
  label: required(string),
  url: required(string)
});

let sidebars = {};
let models = new WeakMap();
let views = new WeakMap();

function viewsFor(button) views.get(button);
function modelFor(button) models.get(button);

const Sidebar = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    let self = this;

    const windowNS = ns();

    let model = merge({}, contract(options));

    models.set(this, model);

    let bars = [];
    sidebarNS(self).tracker = WindowTracker({
      onTrack: function(window) {
        if (!isBrowser(window))
          return;

        let sidebar = window.document.getElementById('sidebar');
        let sidebarBox = window.document.getElementById('sidebar-box');

        let bar = create(window, {
          id: makeID(model.id),
          label: model.label,
          sidebarurl: model.url
        });
        bars.push(bar);
        windowNS(window).bar = bar;

        function onSidebarLoad() {console.log('onSidebarLoad' + model.id)
          // check if the sidebar is ready
          let isReady = sidebar.docShell && sidebar.contentDocument;
          if (!isReady)
            return;
          // check if it is a web panel
          let panelBrowser = sidebar.contentDocument.getElementById(WEB_PANEL_BROWSER_ID);
          if (!panelBrowser) {
            menuitem.removeAttribute('checked');
            return;
          }

          function onWebPanelSidebarLoad() {console.log('onWebPanelSidebarLoad' + model.id)
            if (panelBrowser.contentWindow.location != model.url) {
              return;
            }

            let worker = windowNS(window).worker = Worker({
              window: panelBrowser.contentWindow
            });

            function onHideListener(mutations) {console.log('onHideListener' + model.id)
              mutations.forEach(function(mutation) {
                if (mutation.type == 'attributes' && mutation.attributeName == 'hidden') {
                  emit(self, 'hide', worker);
                  windowNS(window).onHideObs = null;
                  windowNS(window).onHideObs.disconnect();
                }
              })
            }
            windowNS(window).onHideObs = observer(sidebarBox, onHideListener);

/*
            function onWebPanelSidebarUnload() {console.log('onWebPanelSidebarUnload' + model.id)
              panelBrowser.removeEventListener('unload', onWebPanelSidebarUnload, true);
              windowNS(window).onWebPanelSidebarLoad = null;
              emit(self, 'detach', worker);
            }
            windowNS(window).onWebPanelSidebarUnload = onWebPanelSidebarUnload;
            panelBrowser.contentWindow.addEventListener('unload', onWebPanelSidebarUnload, false);
            */

            emit(self, 'show', worker);
            emit(self, 'attach', worker);
          }
          windowNS(window).onWebPanelSidebarLoad = onWebPanelSidebarLoad;
          panelBrowser.addEventListener('DOMWindowCreated', onWebPanelSidebarLoad, true);
        }
        windowNS(window).onSidebarLoad = onSidebarLoad;
        sidebar.addEventListener("load", onSidebarLoad, true);
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
          sidebar.contentDocument.
                  getElementById(WEB_PANEL_BROWSER_ID).
                  removeEventListener('DOMWindowCreated', windowNS(window).onWebPanelSidebarLoad, true);
          windowNS(window).onWebPanelSidebarLoad = null;
        };

        if (windowNS(window).onWebPanelSidebarUnload) {
          windowNS(window).onWebPanelSidebarUnload();
        }

        if (windowNS(window).onHideObs) {
          windowNS(window).onHideObs.disconnect();
          windowNS(window).onHideObs = null;
        }
      }
    });

    views.set(this, bars);

    add(sidebars, this);
  },
  get id() modelFor(this).id,
  dispose: function() {
    off(this);

    hide(this);

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
  let sidebar = window.document.getElementById(makeID(model.id));
  window.openWebPanel(model.label, model.url);
  sidebar.setAttribute('checked', true);
});

hide.define(Sidebar, function(sidebar) {console.log('hide!!')
  if (!isShowing(sidebar))
    return;

  let { document } = getMostRecentBrowserWindow();
  var sidebarBox = document.getElementById("sidebar-box");
  var sidebarSplitter = document.getElementById("sidebar-splitter");

  sidebarBox.hidden = true;
  sidebarSplitter.hidden = true;
});

isShowing.define(Sidebar, function(sidebar) {
  let win = getMostRecentBrowserWindow();
  // make sure there is a window
  if (!win) {
    return false;
  }

  // make sure there is a sidebar for the window
  let ele = win.document.getElementById('sidebar');
  if (!ele) {
    return false;
  }

  // checks if the sidebar box is hidden
  if (win.document.getElementById("sidebar-box").hidden) {
    return false;
  }

  // checks if the sidebar is loading
  if (win.gWebPanelURI == modelFor(sidebar).url) {
    return false;
  }

  // checks if the sidebar loaded already
  ele = ele.contentDocument && ele.contentDocument.getElementById(WEB_PANEL_BROWSER_ID);
  if (ele && ele.contentWindow && ele.contentWindow.location == modelFor(sidebar).url) {
    return true;
  }

  // default
  return false;
});

unload(function() {
  let bars = iterator(sidebars);
  for each (let bar in bars) {
    bar.destroy();
  }
  sidebars = null;
});
