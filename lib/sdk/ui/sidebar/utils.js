/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require("chrome");
const { on, off, emit } = require("../../event/core");
const events = require("../../event/utils");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function create(window, details) {
  let { document } = window;

  details.type = details.type || 'checkbox';
  details.group = details.group || 'sidebar';
  details.autoCheck = details.autoCheck || 'false';
  details.oncommand = 'toggleSidebar("' + details.id + '");';

  let sidebar = document.createElementNS(XUL_NS, 'broadcaster');
  Object.keys(details).forEach(function(atr) {
    sidebar.setAttribute(atr, details[atr]);
  });

  let menuitem = document.createElementNS(XUL_NS, 'menuitem');
  menuitem.setAttribute('id', 'menu_' + details.id);
  menuitem.setAttribute('observes', details.id);

  document.getElementById('mainBroadcasterSet').appendChild(sidebar);
  document.getElementById('viewSidebarMenu').appendChild(menuitem);

  return sidebar;
}
exports.create = create;

function observer(target, handler) {
  // create an observer instance
  var observer = new target.ownerDocument.defaultView.MutationObserver(handler);

  // configuration of the observer:
  var config = { attributes: true, childList: false, characterData: false };

  // pass in the target node, as well as the observer options
  observer.observe(target, config);

  // later, you can stop observing
  return observer;
}
exports.observer = observer;

function dispose(sidebar) {
  let isChecked = sidebar.getAttribute('checked') == 'true';

  // hide sidebar if it is showing
  if (isChecked)
    sidebar.ownerDocument.defaultView.toggleSidebar();

  let menuitem = sidebar.ownerDocument.getElementById('menu_' + sidebar.id);
  menuitem.parentNode.removeChild(menuitem);

  sidebar.parentNode.removeChild(sidebar);
}
exports.dispose = dispose;
