/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require("chrome");
const { on, off, emit } = require("../../event/core");
const events = require("../../event/utils");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function makeID(id) {
  return 'jetpack-sidebar-' + id;
}
exports.makeID = makeID;

function create(window, details) {
  let { document } = window;

  let menuitem = document.createElementNS(XUL_NS, 'menuitem');
  menuitem.setAttribute('id', details.id);
  menuitem.setAttribute('label', details.label);
  menuitem.setAttribute('sidebarurl', details.sidebarurl);
  menuitem.setAttribute('type', 'checkbox');
  menuitem.setAttribute('group', 'sidebar');
  menuitem.setAttribute('autoCheck', 'false');
  menuitem.setAttribute('oncommand', 'openWebPanel("' + details.label + '", "' + details.sidebarurl + '");');

  document.getElementById('viewSidebarMenu').appendChild(menuitem);

  return menuitem;
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

function dispose(menuitem) {
  menuitem.parentNode.removeChild(menuitem);
}
exports.dispose = dispose;
