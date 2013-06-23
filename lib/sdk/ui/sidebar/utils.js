/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { getMostRecentBrowserWindow } = require('sdk/window/utils');

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function create(window, details) {
  let { document } = window;

  let menuitem = document.createElementNS(XUL_NS, 'menuitem');
  menuitem.setAttribute('id', details.id);
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
