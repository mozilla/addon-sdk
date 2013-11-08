/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'unstable',
  'engines': {
    'Firefox': '*',
    'Fennec': '*'
  }
};

const events = require('../../event/utils');
const { ns } = require('../../core/namespace');
const { on, off, emit } = require('../../event/core');
const { isBrowser, getMostRecentBrowserWindow, windows, isWindowPrivate } = require('../../window/utils');
const { MENUS } = require('./constants');
const { events: browserEvents } = require('../../browser/events');
const { ignoreWindow } = require('../../private-browsing/utils');
const { add, remove, has, clear, iterator } = require("../../lang/weak-set");

const components = new WeakMap();

const windowOpen = events.filter(browserEvents, e => e.type === 'load');

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const viewNS = ns();

const views = {};

const eventPipe = {};

function create(details) {
  const bus = {};
  const view = { events: bus };
  const internals = viewNS(view);
  const windowNS = internals.windowNS = ns();
  const { id } = details;

  if (id in views)
    throw new Error('The ID "' + details.id + '" seems already used.');
  views[id] = view;

  let tracker = internals.tracker = function tracker(window) {
    if (!isBrowser(window) || ignoreWindow(window))
      return;

    // fennec ?
    if (window.NativeWindow) {
      // if app menu is included in the list of supported menus
      if (details.menu.indexOf(MENUS.APP_MENU) > -1) {
        let menuitemID = window.NativeWindow.menu.add({
          name: details.label,
          callback: function() {
            emit(bus, 'click');
          }
        });

        window.NativeWindow.menu.update(menuitemID, {
          disabled: details.disabled
        });

        windowNS(window).menuitem = menuitemID;
      }
      else {
        throw Error('No valid menu was found.');
      }
    }
    else {
      let { document } = window;
      if (document.getElementById(details.id))
        throw new Error('The ID "' + details.id + '" seems already used.');

      let ele = document.createElementNS(XUL_NS, 'menuitem');
      ele.setAttribute('id', id);
      ele.setAttribute('label', details.label);
      if ('disabled' in details)
        ele.setAttribute('disabled', (!!details.disabled) + '');

      windowNS(window).menuitemOnClick = function() {
        emit(bus, 'click');
      }
      ele.addEventListener('command', windowNS(window).menuitemOnClick, false);

      let parentNode = findMenu(document, details.menu);
      parentNode.appendChild(ele);

      windowNS(window).menuitem = ele;
    }
  };

  windows(null, { includePrivate: true }).forEach(tracker);
  on(eventPipe, 'render', tracker);

  return view;
}
exports.create = create;

function update(details) {
  let internals = viewNS(views[details.id]);
  if (!internals) {
    return;
  }

  windows(null, { includePrivate: true }).forEach(function(window) {
    let { menuitem } = internals.windowNS(window);
    if (!menuitem) {
      return;
    }

    // fennec ?
    if (window.NativeWindow) {
      window.NativeWindow.menu.update(menuitem, {
        name: details.label,
        enabled: !details.disabled
      });
    }
    else {
      Object.keys(details).forEach(function(key) {
        menuitem.setAttribute(key, details[key]);
      });
    }
  });
}
exports.update = update;

function dispose({ id }) {
  if (!views[id]) {
    return;
  }
  let internals = viewNS(views[id]);

  let { windowNS } = internals
  off(eventPipe, 'render', internals.tracker);
  internals.tracker = null;

  windows(null, { includePrivate: true }).forEach(function(window) {
    let { menuitem } = internals.windowNS(window);
    if (!menuitem) {
      return;
    }

    if (window.NativeWindow) {
      window.NativeWindow.menu.remove(menuitem);
    }
    else {
      menuitem.parentNode.removeChild(menuitem);
      menuitem.removeEventListener('command', windowNS(window).menuitemOnClick, false);
    }
  });

  delete views[id];
}
exports.dispose = dispose;

function findMenu(document, menuIDs) {
  for (let menuID of (menuIDs || [])) {
    let menu = document.getElementById(menuID);
    if (menu) {
      return menu;
    }
  }

  throw Error('No valid menu was found.');
}

on(windowOpen, 'data', function({ target: window }) {
  if (ignoreWindow(window))
    return;

  emit(eventPipe, 'render', window);
});
