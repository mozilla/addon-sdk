"use strict";

const { Cc, Ci } = require("chrome");
const {openWindow, closeWindow, openTab, closeTab,
       openContextMenu, closeContextMenu,
       readNode, captureContextMenu, withTab, withItems } = require("./context-menu/util");
const {when} = require("sdk/dom/events");
const {Item, Menu, Separator, Contexts, Readers } = require("sdk/context-menu@2");

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const menugroup = (...children) => Object.assign({
  tagName: "menugroup",
  namespaceURI: XUL_NS,
  style: "-moz-box-orient: vertical;",
  className: "sdk-context-menu-extension"
}, children.length ? {children} : {});

const menuseparator = () => ({
  tagName: "menuseparator",
  namespaceURI: XUL_NS,
  className: "sdk-context-menu-separator"
})

const menuitem = properties => Object.assign({
  tagName: "menuitem",
  namespaceURI: XUL_NS,
  className: "sdk-context-menu-item menuitem-iconic"
}, properties);

const menu = (properties, ...children) => Object.assign({
  tagName: "menu",
  namespaceURI: XUL_NS,
  className: "sdk-context-menu menu-iconic"
}, properties, children.length ? {children} : {});

// Destroying items that were previously created should cause them to be absent
// from the menu.
exports["test create / destroy menu item"] = withTab(function*(assert) {
  const item = new Item({
    label: "test-1"
  });

  const before = yield captureContextMenu("h1");

  assert.deepEqual(before,
                   menugroup(menuseparator(),
                             menuitem({label: "test-1"})),
                   "context menu contains separator & added item");

  item.destroy();

  const after = yield captureContextMenu("h1");
  assert.deepEqual(after, menugroup(),
                   "all items were removed children are present");
}, "data:text/html,<h1>hello</h1>");


// Items created should be present on all browser windows.
exports["test menu item in new window"] = function*(assert) {
  const isMenuPopulated = function*(tab) {
    const state = yield captureContextMenu("h1", tab);
    assert.deepEqual(state,
                     menugroup(menuseparator(),
                               menuitem({label: "multi-window"})),
                     "created menu item is present")
  };

  const isMenuEmpty = function*(tab) {
    const state = yield captureContextMenu("h1", tab);
    assert.deepEqual(state, menugroup(), "no sdk items present");
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


// Multilpe items can be created and destroyed at different points
// in time & they should not affect each other.
exports["test multiple items"] = withTab(function*(assert) {
  const item1 = new Item({ label: "one" });

  const step1 = yield captureContextMenu("h1");
  assert.deepEqual(step1,
                   menugroup(menuseparator(),
                             menuitem({label: "one"})),
                   "item1 is present");

  const item2 = new Item({ label: "two" });
  const step2 = yield captureContextMenu("h1");

  assert.deepEqual(step2,
                   menugroup(menuseparator(),
                             menuitem({label: "one"}),
                             menuitem({label: "two"})),
                   "both items where present");

  item1.destroy();

  const step3 = yield captureContextMenu("h1");
  assert.deepEqual(step3,
                   menugroup(menuseparator(),
                             menuitem({label: "two"})),
                   "one items left");

  item2.destroy();

  const step4 = yield captureContextMenu("h1");
  assert.deepEqual(step4, menugroup(), "no items left");
}, "data:text/html,<h1>Multiple Items</h1>");

// Destroying an item twice should not cause an error.
exports["test destroy twice"] = withTab(function*(assert) {
  const item = new Item({ label: "destroy" });
  const withItem = yield captureContextMenu("h2");
  assert.deepEqual(withItem,
                   menugroup(menuseparator(),
                             menuitem({label:"destroy"})),
                   "Item is added");

  item.destroy();

  const withoutItem = yield captureContextMenu("h2");
  assert.deepEqual(withoutItem, menugroup(), "Item was removed");

  item.destroy();
  assert.pass("Destroying an item twice should not cause an error.");
}, "data:text/html,<h2>item destroy</h2>");

// CSS selector contexts should cause their items to be absent from the menu
// when the menu is not invoked on nodes that match selectors.
exports["test selector context"] = withTab(function*(assert) {
  const item = new Item({
    context: [new Contexts.Selector("body b")],
    label: "bold"
  });

  const match = yield captureContextMenu("b");
  assert.deepEqual(match,
                   menugroup(menuseparator(),
                             menuitem({label: "bold"})),
                   "item mathched context");

  const noMatch = yield captureContextMenu("i");
  assert.deepEqual(noMatch, menugroup(), "item did not match context");

  item.destroy();

  const cleared = yield captureContextMenu("b");
  assert.deepEqual(cleared, menugroup(), "item was removed");
}, "data:text/html,<body><i>one</i><b>two</b></body>");

// CSS selector contexts should cause their items to be absent in the menu
// when the menu is invoked even on nodes that have ancestors that match the
// selectors.
exports["test parent selector don't match children"] = withTab(function*(assert) {
  const item = new Item({
    label: "parent match",
    context: [new Contexts.Selector("a[href]")]
  });

  const match = yield captureContextMenu("a");
  assert.deepEqual(match,
                   menugroup(menuseparator(),
                             menuitem({label: "parent match"})),
                   "item mathched context");

  const noMatch = yield captureContextMenu("strong");
  assert.deepEqual(noMatch, menugroup(), "item did not mathch context");

  item.destroy();

  const destroyed = yield captureContextMenu("a");
  assert.deepEqual(destroyed, menugroup(), "no items left");
}, "data:text/html,<a href='/foo'>This text must be long & <strong>bold!</strong></a>");

// Page contexts should cause their items to be present in the menu when the
// menu is not invoked on an active element.
exports["test page context match"] = withTab(function*(assert) {
  const isPageMatch = (tree, description="page context matched") =>
    assert.deepEqual(tree,
                     menugroup(menuseparator(),
                               menuitem({label: "page match"}),
                               menuitem({label: "any match"})),
                     description);

  const isntPageMatch = (tree, description="page context did not match") =>
    assert.deepEqual(tree,
                     menugroup(menuseparator(),
                               menuitem({label: "any match"})),
                    description);

  yield* withItems({
    pageMatch: new Item({
      label: "page match",
      context: [new Contexts.Page()],
    }),
    anyMatch: new Item({
      label: "any match"
    })
  }, function*({pageMatch, anyMatch}) {
    for (let tagName of [null, "p", "h3"]) {
      isPageMatch((yield captureContextMenu(tagName)),
                  `Page context matches ${tagName} passive element`);
    }

    for (let tagName of ["button", "canvas", "img", "input", "textarea",
                         "select", "menu", "embed" ,"object", "video", "audio",
                         "applet"])
    {
      isntPageMatch((yield captureContextMenu(tagName)),
                    `Page context does not match <${tagName}/> active element`);
    }

    for (let selector of ["span"])
    {
      isntPageMatch((yield captureContextMenu(selector)),
                    `Page context does not match decedents of active element`);
    }
  });
}, `data:text/html,
<body>
  <div><p>paragraph</p></div>
  <div><a href=./link><span>link</span></a></div>
  <h3>hi</h3>
  <div><button>button</button></div>
  <div><canvas height=10 /></div>
  <div><img height=10 width=10 /></div>
  <div><input value=input /></div>
  <div><textarea>text</textarea></div>
  <div><select><option>one</option><option>two</option></select></div>
  <div><menu><button>item</button></menu></div>
  <div><object width=10 height=10><param name=foo value=bar /></object></div>
  <div><embed width=10 height=10/></div>
  <div><video width=10 height=10 controls /></div>
  <div><audio width=10 height=10 controls /></div>
  <div><applet width=10 height=10 /></div>
</body>`);

require("test").run(exports);
