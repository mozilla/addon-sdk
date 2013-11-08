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

const { ns } = require('../../core/namespace');
const { WindowTracker } = require('../../deprecated/window-utils');
const { off, emit } = require('../../event/core');
const { isBrowser, getMostRecentBrowserWindow, windows, isWindowPrivate } = require('../../window/utils');
const { MENUS } = require('./constants');

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const viewNS = ns();

const views = {};

function create(details) {
  const bus = {};
  const view = { events: bus };
  const internals = viewNS(view);
  const windowNS = internals.windowNS = ns();
  const { id } = details;

  if (id in views)
    throw new Error('The ID "' + details.id + '" seems already used.');
  views[id] = view;

  let tracker = internals.tracker = WindowTracker({
    onTrack: function(window) {
      if (!isBrowser(window))
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
    },
    onUntrack: function(window) {
      if (!isBrowser(window))
        return;

      let menuitem = windowNS(window).menuitem;
      if (window.NativeWindow) {
        window.NativeWindow.menu.remove(menuitem);
      }
      else {
        menuitem.parentNode.removeChild(menuitem);
        menuitem.removeEventListener('command', windowNS(window).menuitemOnClick, false);
      }
    }
  });

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

  viewNS(views[id]).tracker.unload();
  viewNS(views[id]).tracker = null;

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
