"use strict";

const { Cc, Ci } = require("chrome");
const {openWindow, openTab, closeTab,
       openContextMenu, closeContextMenu} = require("./context-menu/util");
const {when} = require("sdk/dom/events");
const {Item, Menu, Seperator, Contexts, Readers } = require("sdk/context-menu@2");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

exports["test create / destroy menu item"] = function*(assert) {
  const item = new Item({
    label: "test-1"
  });


  const tab = yield openTab(`data:text/html,<h1>hello</h1>`);
  const menu = yield openContextMenu(tab, "h1");

  const group = menu.querySelector("#context-menu-extension");
  assert.ok(group, "group for extensions was added");

  assert.equal(group.children[0].localName, "menuseparator",
               "group starts with seperator");

  const {localName, namespaceURI, label} = group.children[1];
  assert.equal(localName, "menuitem", "xul:menuitem element was added");
  assert.equal(namespaceURI, XUL_NS, "xul:menuitem has a xul namespace");
  assert.equal(label, "test-1", "xul:menuitem has expected label");

  yield closeContextMenu(menu);

  item.destroy();

  const menu2 = yield openContextMenu(tab, "h1");
  const group2 = menu2.querySelector("#context-menu-extension")
  assert.equal(group2.children.length,
               0, "item was removed");

  yield closeContextMenu(menu2);


  yield closeTab(tab);
};

require("test").run(exports);
