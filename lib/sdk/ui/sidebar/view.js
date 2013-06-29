/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'unstable',
  'engines': {
    'Firefox': '*'
  }
};

const { models, buttons, views, viewsFor, modelFor } = require('./namespace');
const { isBrowser, getMostRecentBrowserWindow, windows } = require('../../window/utils');
const { setStateFor } = require('../state');

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const WEB_PANEL_BROWSER_ID = 'web-panels-browser';

function create(window, details) {
  let { document } = window;

  let menuitem = document.createElementNS(XUL_NS, 'menuitem');
  menuitem.setAttribute('id', makeID(details.id));
  menuitem.setAttribute('label', details.title);
  menuitem.setAttribute('checked', 'false');
  menuitem.setAttribute('sidebarurl', details.sidebarurl);
  menuitem.setAttribute('type', 'checkbox');
  menuitem.setAttribute('group', 'sidebar');
  menuitem.setAttribute('autoCheck', 'false');

  document.getElementById('viewSidebarMenu').appendChild(menuitem);

  return menuitem;
}
exports.create = create;

function dispose(menuitem) {
  menuitem.parentNode.removeChild(menuitem);
}
exports.dispose = dispose;

function updateTitle(sidebar, title) {console.log('updateTitle')
  let button = buttons.get(sidebar);

  for (let window of windows(null, { includePrivate: true })) {
  	let { document } = window;

    // update the button
    if (button) {
      setStateFor(button, window, { label: title });
    }

    // update the menuitem
    let mi = document.getElementById(makeID(sidebar.id));
    if (mi) {
      mi.setAttribute('label', title)
    }

    // update sidebar, if showing
    if (isSidebarShowing(window, sidebar)) {
      document.getElementById('sidebar-title').setAttribute('value', title);
    }
  }
}
exports.updateTitle = updateTitle;


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
exports.isSidebarShowing = isSidebarShowing;

function showSidebar(window, sidebar) {
  let model = modelFor(sidebar);
  let window = window || getMostRecentBrowserWindow();

  window.openWebPanel(model.title, model.url);

  let menuitem = window.document.getElementById(makeID(model.id));
  menuitem.setAttribute('checked', true);
}
exports.showSidebar = showSidebar;

function makeID(id) {
  return 'jetpack-sidebar-' + id;
}
