/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'experimental',
  'engines': {
    'Firefox': '> 24'
  }
};

const { Class } = require('../core/heritage');
const { EventTarget } = require('../event/target');
const { off, emit, setListeners } = require('../event/core');
const { Worker: WorkerTrait } = require('../content/worker');
const { contract: toolbarContract } = require('./toolbar/contract');
const { models, buttons, views, viewsFor, modelFor } = require('./toolbar/namespace');
const { isBrowser, getMostRecentBrowserWindow, windows, isWindowPrivate } = require('../window/utils');
const { create, dispose } = require('./toolbar/view');
const { ns } = require('../core/namespace');
const { setStateFor, getStateFor } = require('./state');
const { ensure } = require('../system/unload');
const { WindowTracker } = require('../deprecated/window-utils');
const { identify } = require('./id');
const { uuid } = require('../util/uuid');
const { id: addonID } = require('../self');
const { AttributeObserver } = require('../dom/mutations');

const Worker = WorkerTrait.resolve({
  _injectInDocument: '__injectInDocument'
}).compose({
  get _injectInDocument() true
});

const toolbarNS = ns();

const Toolbar = Class({
  extends: EventTarget,
  initialize: function(options) {
    const self = this;
    const internals = toolbarNS(this);
    const windowNS = internals.windowNS = ns();

    let model = toolbarContract(options);
    models.set(this, model);

    // generate an id if one was not provided
    model.id = model.id || addonID + '-' + uuid();

    setListeners(this, options);
    ensure(this, 'destroy');

    internals.tracker = WindowTracker({
      onTrack: function(window) {
        if (!isBrowser(window))
          return;

        let { toolbar, browser, closeButton } = create(window, model);
        windowNS(window).toolbar = toolbar;
        windowNS(window).browser = browser;

        let changeObs = onShowHide.bind(self, toolbar);
        windowNS(window).toolbarObs = AttributeObserver({
          target: toolbar,
          onCollapsed: function() {
            window.document.persist(model.id, 'collapsed');

            let navtoolbox = window.document.getElementById('navigator-toolbox');
            let oldData = JSON.parse(navtoolbox.getAttribute('data-sdk-toolbars') || '{}');
            oldData[model.id] = oldData[model.id] || {};
            oldData[model.id].collapsed = toolbar.collapsed || false;
            navtoolbox.setAttribute('data-sdk-toolbars', JSON.stringify(oldData));
            window.document.persist('navigator-toolbox', 'data-sdk-toolbars');

            changeObs();
          }
        });
        changeObs();

        let worker = windowNS(window).worker = Worker({
          window: browser.contentWindow
        });
        emit(self, 'attach', worker);

        windowNS(window).onFrameUnload = onFrameUnload.bind(self, window);
        browser.contentWindow.addEventListener('unload', windowNS(window).onFrameUnload, true);
      },
      onUntrack: function(window) {
        if (!isBrowser(window))
          return;

        let windowEles = windowNS(window);

        let { toolbarObs } = windowEles;
        if (toolbarObs) {
          toolbarObs.destroy();
          windowEles.toolbarObs = null;
        }

        // kill the toolbar
        let { toolbar } = windowEles;
        if (toolbar) {
          toolbar.parentNode.removeChild(toolbar);
          windowEles.tooblar = null;
        }

        let { worker } = windowEles;
        if (worker) {
          windowEles.worker = null;
        }

        let { onFrameUnload } = windowEles;
        if (onFrameUnload) {
          onFrameUnload(window);
        }
      }
    });
  },
  destroy: function() {
    const internals = toolbarNS(this);

    // stop tracking windows
    if (internals.tracker) {
      internals.tracker.unload();
      internals.tracker = null;
    }

    emit(this, 'destroy');

    internals.windowNS = null;

    views.delete(this);
    models.delete(this);

    off(this);
  },
  get id() modelFor(this).id,
  get url() modelFor(this).url,
  get title() modelFor(this).title,
  set title(value) {
    const internals = toolbarNS(this);

    modelFor(this).title = value;
    updateAtr(internals.windowNS, {
      'toolbarname': value
    });
  },
  show: function() {
    const internals = toolbarNS(this);
    if (!internals.windowNS)
      return;

    let { toolbar } = internals.windowNS(getMostRecentBrowserWindow());
    toolbar && (toolbar.collapsed = false);
  },
  hide: function() {
    const internals = toolbarNS(this);
    if (!internals.windowNS)
      return;

    let { toolbar } = internals.windowNS(getMostRecentBrowserWindow());
    toolbar && (toolbar.collapsed = true);
  }
});
exports.Toolbar = Toolbar;

function onFrameUnload(window) {
  if (!toolbarNS(this) || !toolbarNS(this).windowNS) {
    return;
  }
  let windowNS = toolbarNS(this).windowNS(window);
  let { worker, browser, onFrameUnload } = windowNS;

  if (browser.contentWindow && browser.contentWindow.location.href == 'about:blank') {
    return;
  }

  emit(this, 'detach', worker);

  windowNS.onFrameUnload = null;
  windowNS.browser = null;
  windowNS.worker = null;
}

function updateAtr(windowNS, values) {
  windows(null, { includePrivate: true }).forEach(function(window) {
    let { toolbar } = windowNS(window);
    if (toolbar) {
      Object.keys(values).forEach(function(key) {
        toolbar.setAttribute(key, values[key]);
      });
    }
  })
}

function onShowHide({ collapsed }) {
  emit(this, collapsed ? 'hide' : 'show');
}

identify.define(Toolbar, function(tb) {
  return tb.id;
});
