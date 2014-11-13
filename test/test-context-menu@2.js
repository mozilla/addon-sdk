"use strict";

const { Cc, Ci } = require("chrome");
const {openWindow, closeWindow, openTab, closeTab,
       openContextMenu, closeContextMenu, select,
       readNode, captureContextMenu, withTab, withItems } = require("./context-menu/util");
const {when} = require("sdk/dom/events");
const {Item, Menu, Separator, Contexts, Readers } = require("sdk/context-menu@2");
const testPageURI = require.resolve("./test-context-menu").replace(".js", ".html");

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

// Page context does not match if if there is a selection.
exports["test page context doesn't match on selection"] = withTab(function*(assert) {
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
    yield select("b");
    isntPageMatch((yield captureContextMenu("i")),
                  "page context does not match if there is a selection");

    yield select(null);
    isPageMatch((yield captureContextMenu("i")),
                "page context match if there is no selection");
  });
}, `data:text/html,<body><i>one</i><b>two</b></body>`);

exports["test selection context"] = withTab(function*(assert) {
  yield* withItems({
    item: new Item({
      label: "selection",
      context: [new Contexts.Selection()]
    })
  }, function*({item}) {
    assert.deepEqual((yield captureContextMenu()),
                     menugroup(),
                     "item does not match if there is no selection");

    yield select("b");

    assert.deepEqual((yield captureContextMenu()),
                     menugroup(menuseparator(),
                               menuitem({label: "selection"})),
                     "item matches if there is a selection");
  });
}, `data:text/html,<i>one</i><b>two</b>`);

exports["test selection context in textarea"] = withTab(function*(assert) {
  yield* withItems({
    item: new Item({
      label: "selection",
      context: [new Contexts.Selection()]
    })
  }, function*({item}) {
    assert.deepEqual((yield captureContextMenu()),
                     menugroup(),
                     "does not match if there's no selection");

    yield select({target:"textarea", start:0, end:5});

    assert.deepEqual((yield captureContextMenu("b")),
                 menugroup(),
                 "does not match if target isn't input with selection");

    assert.deepEqual((yield captureContextMenu("textarea")),
                     menugroup(menuseparator(),
                               menuitem({label: "selection"})),
                     "matches if target is input with selected text");

    yield select({target: "textarea", start: 0, end: 0});

    assert.deepEqual((yield captureContextMenu("textarea")),
                 menugroup(),
                 "does not match when selection is cleared");
  });
}, `data:text/html,<textarea>Hello World</textarea><b>!!</b>`);

exports["test url contexts"] = withTab(function*(assert) {
  yield* withItems({
    a: new Item({
      label: "a",
      context: [new Contexts.URL(testPageURI)]
    }),
    b: new Item({
      label: "b",
      context: [new Contexts.URL("*.bogus.com")]
    }),
    c: new Item({
      label: "c",
      context: [new Contexts.URL("*.bogus.com"),
                new Contexts.URL(testPageURI)]
    }),
    d: new Item({
      label: "d",
      context: [new Contexts.URL(/.*\.html/)]
    }),
    e: new Item({
      label: "e",
      context: [new Contexts.URL("http://*"),
                new Contexts.URL(testPageURI)]
    }),
    f: new Item({
      label: "f",
      context: [new Contexts.URL("http://*").required,
                new Contexts.URL(testPageURI)]
    }),
  }, function*(_) {
    assert.deepEqual((yield captureContextMenu()),
                     menugroup(menuseparator(),
                               menuitem({label: "a"}),
                               menuitem({label: "c"}),
                               menuitem({label: "d"}),
                               menuitem({label: "e"})),
                     "shows only matching items");
  });
}, testPageURI);

exports["test iframe context"] = withTab(function*(assert) {
  yield* withItems({
    page: new Item({
      label: "page",
      context: [new Contexts.Page()]
    }),
    iframe: new Item({
      label: "iframe",
      context: [new Contexts.Frame()]
    }),
    h2: new Item({
      label: "element",
      context: [new Contexts.Selector("*")]
    })
  }, function(_) {
    assert.deepEqual((yield captureContextMenu("iframe")),
                     menugroup(menuseparator(),
                               menuitem({label: "page"}),
                               menuitem({label: "iframe"}),
                               menuitem({label: "element"})),
                     "matching items are present");

    assert.deepEqual((yield captureContextMenu("h1")),
                     menugroup(menuseparator(),
                               menuitem({label: "page"}),
                               menuitem({label: "element"})),
                     "only matching items are present");

  });

}, `data:text/html,
<h1>hello</h1>
<iframe src='data:text/html,<body>Bye</body>' />`);

require("test").run(exports);
