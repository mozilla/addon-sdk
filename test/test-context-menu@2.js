"use strict";

const { Cc, Ci } = require("chrome");
const {openWindow, closeWindow, openTab, closeTab,
       openContextMenu, closeContextMenu,
       readNode, captureContextMenu, withTab } = require("./context-menu/util");
const {when} = require("sdk/dom/events");
const {Item, Menu, Seperator, Contexts, Readers } = require("sdk/context-menu@2");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

exports["test create / destroy menu item"] = withTab(function*(assert) {
  const item = new Item({
    label: "test-1"
  });

  const before = yield captureContextMenu("h1");

  assert.deepEqual(before, {
    tagName: "menugroup",
    namespaceURI: XUL_NS,
    style: "-moz-box-orient: vertical;",
    className: "sdk-context-menu-extension",
    children: [{tagName: "menuseparator",
                namespaceURI: XUL_NS,
                className: "sdk-context-menu-separator"},
               {tagName: "menuitem",
                namespaceURI: XUL_NS,
                className: "sdk-context-menu-item menuitem-iconic",
                label: "test-1"}]
  }, "context menu contains seperator & added item");

  item.destroy();

  const after = yield captureContextMenu("h1");
  assert.deepEqual(after, {
    tagName: "menugroup",
    namespaceURI: XUL_NS,
    style: "-moz-box-orient: vertical;",
    className: "sdk-context-menu-extension",
  }, "all items were removed children are present");
}, "data:text/html,<h1>hello</h1>");


exports["test menu item in new window"] = function*(assert) {
  const isMenuPopulated = function*(tab) {
    const state = yield captureContextMenu("h1", tab);
    assert.deepEqual(state, {
      tagName: "menugroup",
      namespaceURI: XUL_NS,
      style: "-moz-box-orient: vertical;",
      className: "sdk-context-menu-extension",
      children: [{tagName: "menuseparator",
                  namespaceURI: XUL_NS,
                  className: "sdk-context-menu-separator"},
                 {tagName: "menuitem",
                  namespaceURI: XUL_NS,
                  className: "sdk-context-menu-item menuitem-iconic",
                  label: "multi-window"}]
    }, "created menu item is present");
  }

  const isMenuEmpty = function*(tab) {
    const state = yield captureContextMenu("h1", tab);
    assert.deepEqual(state, {
      tagName: "menugroup",
      namespaceURI: XUL_NS,
      style: "-moz-box-orient: vertical;",
      className: "sdk-context-menu-extension",
    }, "no sdk items present");
  };

  const item = new Item({ label: "multi-window" });

  const tab1 = yield openTab(`data:text/html,<h1>hello</h1>`);
  yield* isMenuPopulated(tab1);

  const window2 = yield openWindow();
  const tab2 = yield openTab(`data:text/html,<h1>hello window-2</h1>`, window2);

  yield* isMenuPopulated(tab2);

  item.destroy();

  yield* isMenuEmpty(tab2);
  yield closeWindow(window2);

  yield* isMenuEmpty(tab1);

  yield closeTab(tab1);
};


exports["test multiple items"] = withTab(function*(assert) {
  const item1 = new Item({ label: "one" });

  const step1 = yield captureContextMenu("h1");
  assert.deepEqual(step1, {
    tagName: "menugroup",
    namespaceURI: XUL_NS,
    style: "-moz-box-orient: vertical;",
    className: "sdk-context-menu-extension",
    children: [{tagName: "menuseparator",
                namespaceURI: XUL_NS,
                className: "sdk-context-menu-separator"},
               {tagName: "menuitem",
                namespaceURI: XUL_NS,
                className: "sdk-context-menu-item menuitem-iconic",
                label: "one"}]
  }, "item1 is present");

  const item2 = new Item({ label: "two" });
  const step2 = yield captureContextMenu("h1");

  assert.deepEqual(step2, {
      tagName: "menugroup",
      namespaceURI: XUL_NS,
      style: "-moz-box-orient: vertical;",
      className: "sdk-context-menu-extension",
      children: [{tagName: "menuseparator",
                  namespaceURI: XUL_NS,
                  className: "sdk-context-menu-separator"},
                 {tagName: "menuitem",
                  namespaceURI: XUL_NS,
                  className: "sdk-context-menu-item menuitem-iconic",
                  label: "one"},
                 {tagName: "menuitem",
                  namespaceURI: XUL_NS,
                  className: "sdk-context-menu-item menuitem-iconic",
                  label: "two"}]
  }, "both items where present");

  item1.destroy();

  const step3 = yield captureContextMenu("h1");
  assert.deepEqual(step3, {
      tagName: "menugroup",
      namespaceURI: XUL_NS,
      style: "-moz-box-orient: vertical;",
      className: "sdk-context-menu-extension",
      children: [{tagName: "menuseparator",
                  namespaceURI: XUL_NS,
                  className: "sdk-context-menu-separator"},
                 {tagName: "menuitem",
                  namespaceURI: XUL_NS,
                  className: "sdk-context-menu-item menuitem-iconic",
                  label: "two"}]
  }, "one items left");

  item2.destroy();

  const step4 = yield captureContextMenu("h1");
  assert.deepEqual(step4, {
      tagName: "menugroup",
      namespaceURI: XUL_NS,
      style: "-moz-box-orient: vertical;",
      className: "sdk-context-menu-extension",
  }, "no items left");
}, "data:text/html,<h1>Multiple Items</h1>");

require("test").run(exports);
