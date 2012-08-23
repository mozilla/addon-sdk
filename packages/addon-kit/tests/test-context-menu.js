/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let {Cc,Ci} = require("chrome");
const { Loader } = require('test-harness/loader');
const timer = require("timer");

// These should match the same constants in the module.
const ITEM_CLASS = "jetpack-context-menu-item";
const SEPARATOR_ID = "jetpack-context-menu-separator";
const OVERFLOW_THRESH_DEFAULT = 10;
const OVERFLOW_THRESH_PREF =
  "extensions.addon-sdk.context-menu.overflowThreshold";
const OVERFLOW_MENU_ID = "jetpack-content-menu-overflow-menu";
const OVERFLOW_POPUP_ID = "jetpack-content-menu-overflow-popup";

const TEST_DOC_URL = module.uri.replace(/\.js$/, ".html");

// Destroying items that were previously created should cause them to be absent
// from the menu.
exports.testConstructDestroy = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  // Create an item.
  let item = new loader.cm.Item({ label: "item" });
  test.assertEqual(item.parentMenu, null, "item's parent menu should be null");

  test.showMenu(null, function (popup) {

    // It should be present when the menu is shown.
    test.checkMenu([item], [], []);
    popup.hidePopup();

    // Destroy the item.  Multiple destroys should be harmless.
    item.destroy();
    item.destroy();
    test.showMenu(null, function (popup) {

      // It should be removed from the menu.
      test.checkMenu([], [], [item]);
      test.done();
    });
  });
};


// Destroying an item twice should not cause an error.
exports.testDestroyTwice = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({ label: "item" });
  item.destroy();
  item.destroy();

  test.pass("Destroying an item twice should not cause an error.");
  test.done();
};


// CSS selector contexts should cause their items to be present in the menu
// when the menu is invoked on nodes that match the selectors.
exports.testSelectorContextMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    data: "item",
    context: loader.cm.SelectorContext("img")
  });

  test.withTestDoc(function (window, doc) {
    test.showMenu(doc.getElementById("image"), function (popup) {
      test.checkMenu([item], [], []);
      test.done();
    });
  });
};


// CSS selector contexts should cause their items to be present in the menu
// when the menu is invoked on nodes that have ancestors that match the
// selectors.
exports.testSelectorAncestorContextMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    data: "item",
    context: loader.cm.SelectorContext("a[href]")
  });

  test.withTestDoc(function (window, doc) {
    test.showMenu(doc.getElementById("span-link"), function (popup) {
      test.checkMenu([item], [], []);
      test.done();
    });
  });
};


// CSS selector contexts should cause their items to be absent from the menu
// when the menu is not invoked on nodes that match or have ancestors that
// match the selectors.
exports.testSelectorContextNoMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    data: "item",
    context: loader.cm.SelectorContext("img")
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([], [item], []);
    test.done();
  });
};


// Page contexts should cause their items to be present in the menu when the
// menu is not invoked on an active element.
exports.testPageContextMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let items = [
    new loader.cm.Item({
      label: "item 0"
    }),
    new loader.cm.Item({
      label: "item 1",
      context: undefined
    }),
    new loader.cm.Item({
      label: "item 2",
      context: loader.cm.PageContext()
    }),
    new loader.cm.Item({
      label: "item 3",
      context: [loader.cm.PageContext()]
    })
  ];

  test.showMenu(null, function (popup) {
    test.checkMenu(items, [], []);
    test.done();
  });
};


// Page contexts should cause their items to be absent from the menu when the
// menu is invoked on an active element.
exports.testPageContextNoMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let items = [
    new loader.cm.Item({
      label: "item 0"
    }),
    new loader.cm.Item({
      label: "item 1",
      context: undefined
    }),
    new loader.cm.Item({
      label: "item 2",
      context: loader.cm.PageContext()
    }),
    new loader.cm.Item({
      label: "item 3",
      context: [loader.cm.PageContext()]
    })
  ];

  test.withTestDoc(function (window, doc) {
    test.showMenu(doc.getElementById("image"), function (popup) {
      test.checkMenu([], items, []);
      test.done();
    });
  });
};


// Selection contexts should cause items to appear when a selection exists.
exports.testSelectionContextMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = loader.cm.Item({
    label: "item",
    context: loader.cm.SelectionContext()
  });

  test.withTestDoc(function (window, doc) {
    window.getSelection().selectAllChildren(doc.body);
    test.showMenu(null, function (popup) {
      test.checkMenu([item], [], []);
      test.done();
    });
  });
};


// Selection contexts should cause items to appear when a selection exists in
// a text field.
exports.testSelectionContextMatchInTextField = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = loader.cm.Item({
    label: "item",
    context: loader.cm.SelectionContext()
  });

  test.withTestDoc(function (window, doc) {
    let textfield = doc.getElementById("textfield");
    textfield.setSelectionRange(0, textfield.value.length);
    test.showMenu(textfield, function (popup) {
      test.checkMenu([item], [], []);
      test.done();
    });
  });
};


// Selection contexts should not cause items to appear when a selection does
// not exist in a text field.
exports.testSelectionContextNoMatchInTextField = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = loader.cm.Item({
    label: "item",
    context: loader.cm.SelectionContext()
  });

  test.withTestDoc(function (window, doc) {
    let textfield = doc.getElementById("textfield");
    textfield.setSelectionRange(0, 0);
    test.showMenu(textfield, function (popup) {
      test.checkMenu([], [item], []);
      test.done();
    });
  });
};


// Selection contexts should not cause items to appear when a selection does
// not exist.
exports.testSelectionContextNoMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = loader.cm.Item({
    label: "item",
    context: loader.cm.SelectionContext()
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([], [item], []);
    test.done();
  });
};


// URL contexts should cause items to appear on pages that match.
exports.testURLContextMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let items = [
    loader.cm.Item({
      label: "item 0",
      context: loader.cm.URLContext(TEST_DOC_URL)
    }),
    loader.cm.Item({
      label: "item 1",
      context: loader.cm.URLContext([TEST_DOC_URL, "*.bogus.com"])
    })
  ];

  test.withTestDoc(function (window, doc) {
    test.showMenu(null, function (popup) {
      test.checkMenu(items, [], []);
      test.done();
    });
  });
};


// URL contexts should not cause items to appear on pages that do not match.
exports.testURLContextNoMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let items = [
    loader.cm.Item({
      label: "item 0",
      context: loader.cm.URLContext("*.bogus.com")
    }),
    loader.cm.Item({
      label: "item 1",
      context: loader.cm.URLContext(["*.bogus.com", "*.gnarly.com"])
    })
  ];

  test.withTestDoc(function (window, doc) {
    test.showMenu(null, function (popup) {
      test.checkMenu([], items, []);
      test.done();
    });
  });
};


// Removing a non-matching URL context after its item is created and the page is
// loaded should cause the item's content script to be evaluated.
exports.testURLContextRemove = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let shouldBeEvaled = false;
  let context = loader.cm.URLContext("*.bogus.com");
  let item = loader.cm.Item({
    label: "item",
    context: context,
    contentScript: 'self.postMessage("ok");',
    onMessage: function (msg) {
      test.assert(shouldBeEvaled,
                  "content script should be evaluated when expected");
      shouldBeEvaled = false;
      test.done();
    }
  });

  test.withTestDoc(function (window, doc) {
    shouldBeEvaled = true;
    item.context.remove(context);
  });
};


// Adding a non-matching URL context after its item is created and the page is
// loaded should cause the item's worker to be destroyed.
exports.testURLContextAdd = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = loader.cm.Item({ label: "item" });

  test.withTestDoc(function (window, doc) {
    let privatePropsKey = loader.globalScope.PRIVATE_PROPS_KEY;
    let workerReg = item.valueOf(privatePropsKey)._workerReg;

    let found = false;
    for each (let winWorker in workerReg.winWorkers) {
      if (winWorker.win === window) {
        found = true;
        break;
      }
    }
    this.test.assert(found, "window should be present in worker registry");

    item.context.add(loader.cm.URLContext("*.bogus.com"));

    for each (let winWorker in workerReg.winWorkers)
      this.test.assertNotEqual(winWorker.win, window,
        "window should not be present in worker registry");

    test.done();
  });
};


// Content contexts that return true should cause their items to be present
// in the menu.
exports.testContentContextMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    contentScript: 'self.on("context", function () true);'
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([item], [], []);
    test.done();
  });
};


// Content contexts that return false should cause their items to be absent
// from the menu.
exports.testContentContextNoMatch = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    contentScript: 'self.on("context", function () false);'
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([], [item], []);
    test.done();
  });
};


// Content contexts that return a string should cause their items to be present
// in the menu and the items' labels to be updated.
exports.testContentContextMatchString = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "first label",
    contentScript: 'self.on("context", function () "second label");'
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([item], [], []);
    test.assertEqual(item.label, "second label",
                     "item's label should be updated");
    test.done();
  });
};


// Ensure that contentScripFile is working correctly
exports.testContentScriptFile = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  // Reject remote files
  test.assertRaises(function() {
      new loader.cm.Item({
        label: "item",
        contentScriptFile: "http://mozilla.com/context-menu.js"
      });
    },
    "The 'contentScriptFile' option must be a local file URL " +
    "or an array of local file URLs.",
    "Item throws when contentScriptFile is a remote URL");

  // But accept files from data folder
  let item = new loader.cm.Item({
    label: "item",
    contentScriptFile: require("self").data.url("test-context-menu.js")
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([item], [], []);
    test.done();
  });
};


// The args passed to context listeners should be correct.
exports.testContentContextArgs = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();
  let callbacks = 0;

  let item = new loader.cm.Item({
    label: "item",
    contentScript: 'self.on("context", function (node) {' +
                   '  self.postMessage(node.tagName);' +
                   '  return false;' +
                   '});',
    onMessage: function (tagName) {
      test.assertEqual(tagName, "HTML", "node should be an HTML element");
      if (++callbacks == 2) test.done();
    }
  });

  test.showMenu(null, function () {
    if (++callbacks == 2) test.done();
  });
};

// Multiple contexts imply intersection, not union, and content context
// listeners should not be called if all declarative contexts are not current.
exports.testMultipleContexts = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    context: [loader.cm.SelectorContext("a[href]"), loader.cm.PageContext()],
    contentScript: 'self.on("context", function () self.postMessage());',
    onMessage: function () {
      test.fail("Context listener should not be called");
    }
  });

  test.withTestDoc(function (window, doc) {
    test.showMenu(doc.getElementById("span-link"), function (popup) {
      test.checkMenu([], [item], []);
      test.done();
    });
  });
};

// Once a context is removed, it should no longer cause its item to appear.
exports.testRemoveContext = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let ctxt = loader.cm.SelectorContext("img");
  let item = new loader.cm.Item({
    label: "item",
    context: ctxt
  });

  test.withTestDoc(function (window, doc) {
    test.showMenu(doc.getElementById("image"), function (popup) {

      // The item should be present at first.
      test.checkMenu([item], [], []);
      popup.hidePopup();

      // Remove the img context and check again.
      item.context.remove(ctxt);
      test.showMenu(doc.getElementById("image"), function (popup) {
        test.checkMenu([], [item], []);
        test.done();
      });
    });
  });
};


// Lots of items should overflow into the overflow submenu.
exports.testOverflow = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let items = [];
  for (let i = 0; i < OVERFLOW_THRESH_DEFAULT + 1; i++) {
    let item = new loader.cm.Item({ label: "item " + i });
    items.push(item);
  }

  test.showMenu(null, function (popup) {
    test.checkMenu(items, [], []);
    test.done();
  });
};


// Module unload should cause all items to be removed.
exports.testUnload = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({ label: "item" });

  test.showMenu(null, function (popup) {

    // The menu should contain the item.
    test.checkMenu([item], [], []);
    popup.hidePopup();

    // Unload the module.
    loader.unload();
    test.showMenu(null, function (popup) {

      // The item should be removed from the menu.
      test.checkMenu([], [], [item]);
      test.done();
    });
  });
};


// Using multiple module instances to add items without causing overflow should
// work OK.  Assumes OVERFLOW_THRESH_DEFAULT <= 2.
exports.testMultipleModulesAdd = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  // Use each module to add an item, then unload each module in turn.
  let item0 = new loader0.cm.Item({ label: "item 0" });
  let item1 = new loader1.cm.Item({ label: "item 1" });

  test.showMenu(null, function (popup) {

    // The menu should contain both items.
    test.checkMenu([item0, item1], [], []);
    popup.hidePopup();

    // Unload the first module.
    loader0.unload();
    test.showMenu(null, function (popup) {

      // The first item should be removed from the menu.
      test.checkMenu([item1], [], [item0]);
      popup.hidePopup();

      // Unload the second module.
      loader1.unload();
      test.showMenu(null, function (popup) {

        // Both items should be removed from the menu.
        test.checkMenu([], [], [item0, item1]);
        test.done();
      });
    });
  });
};


// Using multiple module instances to add items causing overflow should work OK.
exports.testMultipleModulesAddOverflow = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  // Use module 0 to add OVERFLOW_THRESH_DEFAULT items.
  let items0 = [];
  for (let i = 0; i < OVERFLOW_THRESH_DEFAULT; i++) {
    let item = new loader0.cm.Item({ label: "item 0 " + i });
    items0.push(item);
  }

  // Use module 1 to add one item.
  let item1 = new loader1.cm.Item({ label: "item 1" });

  let allItems = items0.concat(item1);

  test.showMenu(null, function (popup) {

    // The menu should contain all items in overflow.
    test.checkMenu(allItems, [], []);
    popup.hidePopup();

    // Unload the first module.
    loader0.unload();
    test.showMenu(null, function (popup) {

      // The first items should be removed from the menu, which should not
      // overflow.
      test.checkMenu([item1], [], items0);
      popup.hidePopup();

      // Unload the second module.
      loader1.unload();
      test.showMenu(null, function (popup) {

        // All items should be removed from the menu.
        test.checkMenu([], [], allItems);
        test.done();
      });
    });
  });
};


// Using multiple module instances to modify the menu without causing overflow
// should work OK.  This test creates two loaders and:
// loader0 create item -> loader1 create item -> loader0.unload ->
// loader1.unload
exports.testMultipleModulesDiffContexts1 = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  let item0 = new loader0.cm.Item({
    label: "item 0",
    context: loader0.cm.SelectorContext("img")
  });

  let item1 = new loader1.cm.Item({ label: "item 1" });

  test.showMenu(null, function (popup) {

    // The menu should contain item1.
    test.checkMenu([item1], [item0], []);
    popup.hidePopup();

    // Unload module 0.
    loader0.unload();
    test.showMenu(null, function (popup) {

      // item0 should be removed from the menu.
      test.checkMenu([item1], [], [item0]);
      popup.hidePopup();

      // Unload module 1.
      loader1.unload();
      test.showMenu(null, function (popup) {

        // Both items should be removed from the menu.
        test.checkMenu([], [], [item0, item1]);
        test.done();
      });
    });
  });
};


// Using multiple module instances to modify the menu without causing overflow
// should work OK.  This test creates two loaders and:
// loader1 create item -> loader0 create item -> loader0.unload ->
// loader1.unload
exports.testMultipleModulesDiffContexts2 = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  let item1 = new loader1.cm.Item({ label: "item 1" });

  let item0 = new loader0.cm.Item({
    label: "item 0",
    context: loader0.cm.SelectorContext("img")
  });

  test.showMenu(null, function (popup) {

    // The menu should contain item1.
    test.checkMenu([item1], [item0], []);
    popup.hidePopup();

    // Unload module 0.
    loader0.unload();
    test.showMenu(null, function (popup) {

      // item0 should be removed from the menu.
      test.checkMenu([item1], [], [item0]);
      popup.hidePopup();

      // Unload module 1.
      loader1.unload();
      test.showMenu(null, function (popup) {

        // Both items should be removed from the menu.
        test.checkMenu([], [], [item0, item1]);
        test.done();
      });
    });
  });
};


// Using multiple module instances to modify the menu without causing overflow
// should work OK.  This test creates two loaders and:
// loader0 create item -> loader1 create item -> loader1.unload ->
// loader0.unload
exports.testMultipleModulesDiffContexts3 = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  let item0 = new loader0.cm.Item({
    label: "item 0",
    context: loader0.cm.SelectorContext("img")
  });

  let item1 = new loader1.cm.Item({ label: "item 1" });

  test.showMenu(null, function (popup) {

    // The menu should contain item1.
    test.checkMenu([item1], [item0], []);
    popup.hidePopup();

    // Unload module 1.
    loader1.unload();
    test.showMenu(null, function (popup) {

      // item1 should be removed from the menu.
      test.checkMenu([], [item0], [item1]);
      popup.hidePopup();

      // Unload module 0.
      loader0.unload();
      test.showMenu(null, function (popup) {

        // Both items should be removed from the menu.
        test.checkMenu([], [], [item0, item1]);
        test.done();
      });
    });
  });
};


// Using multiple module instances to modify the menu without causing overflow
// should work OK.  This test creates two loaders and:
// loader1 create item -> loader0 create item -> loader1.unload ->
// loader0.unload
exports.testMultipleModulesDiffContexts4 = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  let item1 = new loader1.cm.Item({ label: "item 1" });

  let item0 = new loader0.cm.Item({
    label: "item 0",
    context: loader0.cm.SelectorContext("img")
  });

  test.showMenu(null, function (popup) {

    // The menu should contain item1.
    test.checkMenu([item1], [item0], []);
    popup.hidePopup();

    // Unload module 1.
    loader1.unload();
    test.showMenu(null, function (popup) {

      // item1 should be removed from the menu.
      test.checkMenu([], [item0], [item1]);
      popup.hidePopup();

      // Unload module 0.
      loader0.unload();
      test.showMenu(null, function (popup) {

        // Both items should be removed from the menu.
        test.checkMenu([], [], [item0, item1]);
        test.done();
      });
    });
  });
};


// Test interactions between a loaded module, unloading another module, and the
// menu separator and overflow submenu.
exports.testMultipleModulesAddRemove = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  let item = new loader0.cm.Item({ label: "item" });

  test.showMenu(null, function (popup) {

    // The menu should contain the item.
    test.checkMenu([item], [], []);
    popup.hidePopup();

    // Remove the item.
    item.destroy();
    test.showMenu(null, function (popup) {

      // The item should be removed from the menu.
      test.checkMenu([], [], [item]);
      popup.hidePopup();

      // Unload module 1.
      loader1.unload();
      test.showMenu(null, function (popup) {

        // There shouldn't be any errors involving the menu separator or
        // overflow submenu.
        test.checkMenu([], [], [item]);
        test.done();
      });
    });
  });
};


// An item's click listener should work.
exports.testItemClick = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    data: "item data",
    contentScript: 'self.on("click", function (node, data) {' +
                   '  let Ci = Components["interfaces"];' +
                   '  self.postMessage({' +
                   '    tagName: node.tagName,' +
                   '    data: data' +
                   '  });' +
                   '});',
    onMessage: function (data) {
      test.assertEqual(this, item, "`this` inside onMessage should be item");
      test.assertEqual(data.tagName, "HTML", "node should be an HTML element");
      test.assertEqual(data.data, item.data, "data should be item data");
      test.done();
    }
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([item], [], []);
    let elt = test.getItemElt(popup, item);
    elt.click();
  });
};


// A menu's click listener should work and receive bubbling clicks from
// sub-items appropriately.  This also tests menus and ensures that when a CSS
// selector context matches the clicked node's ancestor, the matching ancestor
// is passed to listeners as the clicked node.
exports.testMenuClick = function (test) {
  // Create a top-level menu, submenu, and item, like this:
  // topMenu -> submenu -> item
  // Click the item and make sure the click bubbles.
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "submenu item",
    data: "submenu item data"
  });

  let submenu = new loader.cm.Menu({
    label: "submenu",
    items: [item]
  });

  let topMenu = new loader.cm.Menu({
    label: "top menu",
    contentScript: 'self.on("click", function (node, data) {' +
                   '  let Ci = Components["interfaces"];' +
                   '  self.postMessage({' +
                   '    tagName: node.tagName,' +
                   '    data: data' +
                   '  });' +
                   '});',
    onMessage: function (data) {
      test.assertEqual(this, topMenu, "`this` inside top menu should be menu");
      test.assertEqual(data.tagName, "A", "Clicked node should be anchor");
      test.assertEqual(data.data, item.data,
                       "Clicked item data should be correct");
      test.done();
    },
    items: [submenu],
    context: loader.cm.SelectorContext("a")
  });

  test.withTestDoc(function (window, doc) {
    test.showMenu(doc.getElementById("span-link"), function (popup) {
      test.checkMenu([topMenu], [], []);
      let topMenuElt = test.getItemElt(popup, topMenu);
      let topMenuPopup = topMenuElt.firstChild;
      let submenuElt = test.getItemElt(topMenuPopup, submenu);
      let submenuPopup = submenuElt.firstChild;
      let itemElt = test.getItemElt(submenuPopup, item);
      itemElt.click();
    });
  });
};

// Click listeners should work when multiple modules are loaded.
exports.testItemClickMultipleModules = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  let item0 = loader0.cm.Item({
    label: "loader 0 item",
    contentScript: 'self.on("click", self.postMessage);',
    onMessage: function () {
      test.fail("loader 0 item should not emit click event");
    }
  });
  let item1 = loader1.cm.Item({
    label: "loader 1 item",
    contentScript: 'self.on("click", self.postMessage);',
    onMessage: function () {
      test.pass("loader 1 item clicked as expected");
      test.done();
    }
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([item0, item1], [], []);
    let item1Elt = test.getItemElt(popup, item1);
    item1Elt.click();
  });
};


// Adding a separator to a submenu should work OK.
exports.testSeparator = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let menu = new loader.cm.Menu({
    label: "submenu",
    items: [new loader.cm.Separator()]
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([menu], [], []);
    test.done();
  });
};


// Existing context menu modifications should apply to new windows.
exports.testNewWindow = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({ label: "item" });

  test.withNewWindow(function () {
    test.showMenu(null, function (popup) {
      test.checkMenu([item], [], []);
      test.done();
    });
  });
};


// When a new window is opened, items added by an unloaded module should not
// be present in the menu.
exports.testNewWindowMultipleModules = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();
  let item = new loader.cm.Item({ label: "item" });

  test.showMenu(null, function (popup) {
    test.checkMenu([item], [], []);
    popup.hidePopup();
    loader.unload();
    test.withNewWindow(function () {
      test.showMenu(null, function (popup) {
        test.checkMenu([], [], []);
        test.done();
      });
    });
  });
};


// Items in the context menu should be sorted according to locale.
exports.testSorting = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  // Make an unsorted items list.  It'll look like this:
  //   item 1, item 0, item 3, item 2, item 5, item 4, ...
  let items = [];
  for (let i = 0; i < OVERFLOW_THRESH_DEFAULT; i += 2) {
    items.push(new loader.cm.Item({ label: "item " + (i + 1) }));
    items.push(new loader.cm.Item({ label: "item " + i }));
  }

  test.showMenu(null, function (popup) {
    test.checkMenu(items, [], []);
    test.done();
  });
};


// Items in the overflow menu should be sorted according to locale.
exports.testSortingOverflow = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  // Make an unsorted items list.  It'll look like this:
  //   item 1, item 0, item 3, item 2, item 5, item 4, ...
  let items = [];
  for (let i = 0; i < OVERFLOW_THRESH_DEFAULT * 2; i += 2) {
    items.push(new loader.cm.Item({ label: "item " + (i + 1) }));
    items.push(new loader.cm.Item({ label: "item " + i }));
  }

  test.showMenu(null, function (popup) {
    test.checkMenu(items, [], []);
    test.done();
  });
};


// Multiple modules shouldn't interfere with sorting.
exports.testSortingMultipleModules = function (test) {
  test = new TestHelper(test);
  let loader0 = test.newLoader();
  let loader1 = test.newLoader();

  let items0 = [];
  let items1 = [];
  for (let i = 0; i < OVERFLOW_THRESH_DEFAULT; i++) {
    if (i % 2) {
      let item = new loader0.cm.Item({ label: "item " + i });
      items0.push(item);
    }
    else {
      let item = new loader1.cm.Item({ label: "item " + i });
      items1.push(item);
    }
  }
  let allItems = items0.concat(items1);

  test.showMenu(null, function (popup) {

    // All items should be present and sorted.
    test.checkMenu(allItems, [], []);
    popup.hidePopup();
    loader0.unload();
    loader1.unload();
    test.showMenu(null, function (popup) {

      // All items should be removed.
      test.checkMenu([], [], allItems);
      test.done();
    });
  });
};


// The binary search of insertionPoint should work OK.
exports.testInsertionPoint = function (test) {
  function mockElts(labels) {
    return labels.map(function (label) {
      return { label: label, getAttribute: function (l) label };
    });
  }

  test = new TestHelper(test);
  let loader = test.newLoader();
  let insertionPoint = loader.globalScope.insertionPoint;

  let ip = insertionPoint("a", []);
  test.assertStrictEqual(ip, null, "Insertion point should be null");

  ip = insertionPoint("a", mockElts(["b"]));
  test.assertEqual(ip.label, "b", "Insertion point should be 'b'");

  ip = insertionPoint("c", mockElts(["b"]));
  test.assertStrictEqual(ip, null, "Insertion point should be null");

  ip = insertionPoint("b", mockElts(["a", "c"]));
  test.assertEqual(ip.label, "c", "Insertion point should be 'c'");

  ip = insertionPoint("c", mockElts(["a", "b", "d"]));
  test.assertEqual(ip.label, "d", "Insertion point should be 'd'");

  ip = insertionPoint("a", mockElts(["b", "c", "d"]));
  test.assertEqual(ip.label, "b", "Insertion point should be 'b'");

  ip = insertionPoint("d", mockElts(["a", "b", "c"]));
  test.assertStrictEqual(ip, null, "Insertion point should be null");

  test.done();
};


// Content click handlers and context handlers should be able to communicate,
// i.e., they're eval'ed in the same worker and sandbox.
exports.testContentCommunication = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    contentScript: 'var potato;' +
                   'self.on("context", function () {' +
                   '  potato = "potato";' +
                   '  return true;' +
                   '});' +
                   'self.on("click", function () {' +
                   '  self.postMessage(potato);' +
                   '});',
  });

  item.on("message", function (data) {
    test.assertEqual(data, "potato", "That's a lot of potatoes!");
    test.done();
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([item], [], []);
    let elt = test.getItemElt(popup, item);
    elt.click();
  });
};


// When the context menu is invoked on a tab that was already open when the
// module was loaded, it should contain the expected items and content workers
// should function as expected.
exports.testLoadWithOpenTab = function (test) {
  test = new TestHelper(test);
  test.withTestDoc(function (window, doc) {
    let loader = test.newLoader();
    let item = new loader.cm.Item({
      label: "item",
      contentScript:
        'self.on("click", function () self.postMessage("click"));',
      onMessage: function (msg) {
        if (msg === "click")
          test.done();
      }
    });
    test.showMenu(null, function (popup) {
      test.checkMenu([item], [], []);
      test.getItemElt(popup, item).click();
    });
  });
};

// Bug 732716: Ensure that the node given in `click` event works fine
// (i.e. is correctly wrapped)
exports.testDrawImageOnClickNode = function (test) {
  test = new TestHelper(test);
  test.withTestDoc(function (window, doc) {
    let loader = test.newLoader();
    let item = new loader.cm.Item({
      label: "item",
      context: loader.cm.SelectorContext("img"),
      contentScript: "new " + function() {
        self.on("click", function (img, data) {
          let ctx = document.createElement("canvas").getContext("2d");
          ctx.drawImage(img, 1, 1, 1, 1);
          self.postMessage("done");
        });
      },
      onMessage: function (msg) {
        if (msg === "done")
          test.done();
      }
    });
    test.showMenu(doc.getElementById("image"), function (popup) {
      test.checkMenu([item], [], []);
      test.getItemElt(popup, item).click();
    });
  });
};

// Setting an item's label before the menu is ever shown should correctly change
// its label and, if necessary, its order within the menu.
exports.testSetLabelBeforeShow = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let items = [
    new loader.cm.Item({ label: "a" }),
    new loader.cm.Item({ label: "b" })
  ]
  items[0].label = "z";
  test.assertEqual(items[0].label, "z");

  test.showMenu(null, function (popup) {
    test.checkMenu([items[1], items[0]], [], []);
    test.done();
  });
};


// Setting an item's label after the menu is shown should correctly change its
// label and, if necessary, its order within the menu.
exports.testSetLabelAfterShow = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let items = [
    new loader.cm.Item({ label: "a" }),
    new loader.cm.Item({ label: "b" })
  ];

  test.showMenu(null, function (popup) {
    test.checkMenu(items, [], []);
    popup.hidePopup();

    items[0].label = "z";
    test.assertEqual(items[0].label, "z");
    test.showMenu(null, function (popup) {
      test.checkMenu([items[1], items[0]], [], []);
      test.done();
    });
  });
};


// Setting an item's label before the menu is ever shown should correctly change
// its label and, if necessary, its order within the menu if the item is in the
// overflow submenu.
exports.testSetLabelBeforeShowOverflow = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let prefs = loader.loader.require("preferences-service");
  prefs.set(OVERFLOW_THRESH_PREF, 0);

  let items = [
    new loader.cm.Item({ label: "a" }),
    new loader.cm.Item({ label: "b" })
  ]
  items[0].label = "z";
  test.assertEqual(items[0].label, "z");

  test.showMenu(null, function (popup) {
    test.checkMenu([items[1], items[0]], [], []);
    prefs.set(OVERFLOW_THRESH_PREF, OVERFLOW_THRESH_DEFAULT);
    test.done();
  });
};


// Setting an item's label after the menu is shown should correctly change its
// label and, if necessary, its order within the menu if the item is in the
// overflow submenu.
exports.testSetLabelAfterShowOverflow = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let prefs = loader.loader.require("preferences-service");
  prefs.set(OVERFLOW_THRESH_PREF, 0);

  let items = [
    new loader.cm.Item({ label: "a" }),
    new loader.cm.Item({ label: "b" })
  ];

  test.showMenu(null, function (popup) {
    test.checkMenu(items, [], []);
    popup.hidePopup();

    items[0].label = "z";
    test.assertEqual(items[0].label, "z");
    test.showMenu(null, function (popup) {
      test.checkMenu([items[1], items[0]], [], []);
      prefs.set(OVERFLOW_THRESH_PREF, OVERFLOW_THRESH_DEFAULT);
      test.done();
    });
  });
};


// Setting the label of an item in a Menu should work.
exports.testSetLabelMenuItem = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let menu = loader.cm.Menu({
    label: "menu",
    items: [loader.cm.Item({ label: "a" })]
  });
  menu.items[0].label = "z";

  test.assertEqual(menu.items[0].label, "z");

  test.showMenu(null, function (popup) {
    test.checkMenu([menu], [], []);
    test.done();
  });
};


// Menu.addItem() should work.
exports.testMenuAddItem = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let menu = loader.cm.Menu({
    label: "menu",
    items: [
      loader.cm.Item({ label: "item 0" })
    ]
  });
  menu.addItem(loader.cm.Item({ label: "item 1" }));
  menu.addItem(loader.cm.Item({ label: "item 2" }));

  test.assertEqual(menu.items.length, 3,
                   "menu should have correct number of items");
  for (let i = 0; i < 3; i++) {
    test.assertEqual(menu.items[i].label, "item " + i,
                     "item label should be correct");
    test.assertEqual(menu.items[i].parentMenu, menu,
                     "item's parent menu should be correct");
  }

  test.showMenu(null, function (popup) {
    test.checkMenu([menu], [], []);
    test.done();
  });
};


// Adding the same item twice to a menu should work as expected.
exports.testMenuAddItemTwice = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let menu = loader.cm.Menu({
    label: "menu",
    items: []
  });
  let subitem = loader.cm.Item({ label: "item 1" })
  menu.addItem(subitem);
  menu.addItem(loader.cm.Item({ label: "item 0" }));
  menu.addItem(subitem);

  test.assertEqual(menu.items.length, 2,
                   "menu should have correct number of items");
  for (let i = 0; i < 2; i++) {
    test.assertEqual(menu.items[i].label, "item " + i,
                     "item label should be correct");
  }

  test.showMenu(null, function (popup) {
    test.checkMenu([menu], [], []);
    test.done();
  });
};


// Menu.removeItem() should work.
exports.testMenuRemoveItem = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let subitem = loader.cm.Item({ label: "item 1" });
  let menu = loader.cm.Menu({
    label: "menu",
    items: [
      loader.cm.Item({ label: "item 0" }),
      subitem,
      loader.cm.Item({ label: "item 2" })
    ]
  });

  // Removing twice should be harmless.
  menu.removeItem(subitem);
  menu.removeItem(subitem);

  test.assertEqual(subitem.parentMenu, null,
                   "item's parent menu should be correct");

  test.assertEqual(menu.items.length, 2,
                   "menu should have correct number of items");
  test.assertEqual(menu.items[0].label, "item 0",
                   "item label should be correct");
  test.assertEqual(menu.items[1].label, "item 2",
                   "item label should be correct");

  test.showMenu(null, function (popup) {
    test.checkMenu([menu], [], []);
    test.done();
  });
};


// Adding an item currently contained in one menu to another menu should work.
exports.testMenuItemSwap = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let subitem = loader.cm.Item({ label: "item" });
  let menu0 = loader.cm.Menu({
    label: "menu 0",
    items: [subitem]
  });
  let menu1 = loader.cm.Menu({
    label: "menu 1",
    items: []
  });
  menu1.addItem(subitem);

  test.assertEqual(menu0.items.length, 0,
                   "menu should have correct number of items");

  test.assertEqual(menu1.items.length, 1,
                   "menu should have correct number of items");
  test.assertEqual(menu1.items[0].label, "item",
                   "item label should be correct");

  test.assertEqual(subitem.parentMenu, menu1,
                   "item's parent menu should be correct");

  test.showMenu(null, function (popup) {
    test.checkMenu([menu0, menu1], [], []);
    test.done();
  });
};


// Destroying an item should remove it from its parent menu.
exports.testMenuItemDestroy = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let subitem = loader.cm.Item({ label: "item" });
  let menu = loader.cm.Menu({
    label: "menu",
    items: [subitem]
  });
  subitem.destroy();

  test.assertEqual(menu.items.length, 0,
                   "menu should have correct number of items");
  test.assertEqual(subitem.parentMenu, null,
                   "item's parent menu should be correct");

  test.showMenu(null, function (popup) {
    test.checkMenu([menu], [], []);
    test.done();
  });
};


// Setting Menu.items should work.
exports.testMenuItemsSetter = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let menu = loader.cm.Menu({
    label: "menu",
    items: [
      loader.cm.Item({ label: "old item 0" }),
      loader.cm.Item({ label: "old item 1" })
    ]
  });
  menu.items = [
    loader.cm.Item({ label: "new item 0" }),
    loader.cm.Item({ label: "new item 1" }),
    loader.cm.Item({ label: "new item 2" })
  ];

  test.assertEqual(menu.items.length, 3,
                   "menu should have correct number of items");
  for (let i = 0; i < 3; i++) {
    test.assertEqual(menu.items[i].label, "new item " + i,
                     "item label should be correct");
    test.assertEqual(menu.items[i].parentMenu, menu,
                     "item's parent menu should be correct");
  }

  test.showMenu(null, function (popup) {
    test.checkMenu([menu], [], []);
    test.done();
  });
};


// Setting Item.data should work.
exports.testItemDataSetter = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = loader.cm.Item({ label: "old item 0", data: "old" });
  item.data = "new";

  test.assertEqual(item.data, "new", "item should have correct data");

  test.showMenu(null, function (popup) {
    test.checkMenu([item], [], []);
    test.done();
  });
};


// Open the test doc, load the module, make sure items appear when context-
// clicking the iframe.
exports.testAlreadyOpenIframe = function (test) {
  test = new TestHelper(test);
  test.withTestDoc(function (window, doc) {
    let loader = test.newLoader();
    let item = new loader.cm.Item({
      label: "item"
    });
    test.showMenu(doc.getElementById("iframe"), function (popup) {
      test.checkMenu([item], [], []);
      test.done();
    });
  });
};


// Test image support.
exports.testItemImage = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let imageURL = require("self").data.url("moz_favicon.ico");
  let item = new loader.cm.Item({ label: "item", image: imageURL });
  let menu = new loader.cm.Menu({ label: "menu", image: imageURL, items: [] });

  test.showMenu(null, function (popup) {
    test.checkMenu([item, menu], [], []);

    let imageURL2 = require("self").data.url("dummy.ico");
    item.image = imageURL2;
    menu.image = imageURL2;
    test.checkMenu([item, menu], [], []);

    item.image = null;
    menu.image = null;
    test.checkMenu([item, menu], [], []);

    test.done();
  });
};


// Menu.destroy should destroy the item tree rooted at that menu.
exports.testMenuDestroy = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let menu = loader.cm.Menu({
    label: "menu",
    items: [
      loader.cm.Item({ label: "item 0" }),
      loader.cm.Menu({
        label: "item 1",
        items: [
          loader.cm.Item({ label: "subitem 0" }),
          loader.cm.Item({ label: "subitem 1" }),
          loader.cm.Item({ label: "subitem 2" })
        ]
      }),
      loader.cm.Item({ label: "item 2" })
    ]
  });
  menu.destroy();

  let numRegistryEntries = 0;
  loader.globalScope.browserManager.browserWins.forEach(function (bwin) {
    for (let itemID in bwin.items)
      numRegistryEntries++;
  });
  test.assertEqual(numRegistryEntries, 0, "All items should be unregistered.");

  test.showMenu(null, function (popup) {
    test.checkMenu([], [], [menu]);
    test.done();
  });
};


// NO TESTS BELOW THIS LINE! ///////////////////////////////////////////////////

// Run only a dummy test if context-menu doesn't support the host app.
if (!require("xul-app").is("Firefox")) {
  module.exports = {
    testAppNotSupported: function (test) {
      test.pass("context-menu does not support this application.");
    }
  };
}


// This makes it easier to run tests by handling things like opening the menu,
// opening new windows, making assertions, etc.  Methods on |test| can be called
// on instances of this class.  Don't forget to call done() to end the test!
// WARNING: This looks up items in popups by comparing labels, so don't give two
// items the same label.
function TestHelper(test) {
  // default waitUntilDone timeout is 10s, which is too short on the win7
  // buildslave
  test.waitUntilDone(30*1000);
  this.test = test;
  this.loaders = [];
  this.browserWindow = Cc["@mozilla.org/appshell/window-mediator;1"].
                       getService(Ci.nsIWindowMediator).
                       getMostRecentWindow("navigator:browser");
}

TestHelper.prototype = {
  get contextMenuPopup() {
    return this.browserWindow.document.getElementById("contentAreaContextMenu");
  },

  get contextMenuSeparator() {
    return this.browserWindow.document.getElementById(SEPARATOR_ID);
  },

  get overflowPopup() {
    return this.browserWindow.document.getElementById(OVERFLOW_POPUP_ID);
  },

  get overflowSubmenu() {
    return this.browserWindow.document.getElementById(OVERFLOW_MENU_ID);
  },

  get tabBrowser() {
    return this.browserWindow.gBrowser;
  },

  // Methods on the wrapped test can be called on this object.
  __noSuchMethod__: function (methodName, args) {
    this.test[methodName].apply(this.test, args);
  },

  // Asserts that absentItems -- an array of items that should not match the
  // current context -- aren't present in the menu.
  checkAbsentItems: function (presentItems, absentItems) {
    for (let i = 0; i < absentItems.length; i++) {
      let item = absentItems[i];
      let elt = this.getItemElt(this.contextMenuPopup, item);

      // The implementation actually hides items rather than removing or not
      // adding them in the first place, but that's an implementation detail.
      this.test.assert(!elt || elt.hidden,
                       "Item should not be present in top-level menu");

      if (this.shouldOverflow(presentItems)) {
        elt = getItemElt(this.overflowPopup, item);
        this.test.assert(!elt || elt.hidden,
                         "Item should not be present in overflow submenu");
      }
    }
  },

  // Asserts that elt, a DOM element representing item, looks OK.
  checkItemElt: function (elt, item) {
    let itemType = this.getItemType(item);

    switch (itemType) {
    case "Item":
      this.test.assertEqual(elt.localName, "menuitem",
                            "Item DOM element should be a xul:menuitem");
      if (typeof(item.data) === "string") {
        this.test.assertEqual(elt.getAttribute("value"), item.data,
                              "Item should have correct data");
      }
      break
    case "Menu":
      this.test.assertEqual(elt.localName, "menu",
                            "Menu DOM element should be a xul:menu");
      let subPopup = elt.firstChild;
      this.test.assert(subPopup, "xul:menu should have a child");
      this.test.assertEqual(subPopup.localName, "menupopup",
                            "xul:menu's first child should be a menupopup");
      break;
    case "Separator":
      this.test.assertEqual(elt.localName, "menuseparator",
                         "Separator DOM element should be a xul:menuseparator");
      break;
    }

    if (itemType === "Item" || itemType === "Menu") {
      this.test.assertEqual(elt.getAttribute("label"), item.label,
                            "Item should have correct title");
      if (typeof(item.image) === "string")
        this.test.assertEqual(elt.getAttribute("image"), item.image,
                              "Item should have correct image");
      else
        this.test.assert(!elt.hasAttribute("image"),
                         "Item should not have image");
    }
  },

  // Asserts that the context menu looks OK given the arguments.  presentItems
  // are items that should match the current context.  absentItems are items
  // that shouldn't.  removedItems are items that have been removed from the
  // menu.
  checkMenu: function (presentItems, absentItems, removedItems) {
    this.checkSeparator(presentItems);
    this.checkOverflow(presentItems);
    this.checkPresentItems(presentItems);
    this.checkAbsentItems(presentItems, absentItems);
    this.checkRemovedItems(removedItems);
    this.checkSort(presentItems);
  },

  // Asserts that the overflow submenu is present or absent as appropriate for
  // presentItems.
  checkOverflow: function (presentItems) {
    let submenu = this.overflowSubmenu;
    if (this.shouldOverflow(presentItems)) {
      this.test.assert(submenu && !submenu.hidden,
                       "Overflow submenu should be present");
      this.test.assert(submenu.localName, "menu",
                       "Overflow submenu should be a <menu>");
      let overflowPopup = this.overflowPopup;
      this.test.assert(overflowPopup,
                       "Overflow submenu popup should be present");
      this.test.assert(overflowPopup.localName, "menupopup",
                       "Overflow submenu popup should be a <menupopup>");
    }
    else {
      this.test.assert(!submenu || submenu.hidden,
                       "Overflow submenu should be absent");
    }
  },

  // Asserts that the items that are present in the menu because they match the
  // current context look OK.
  checkPresentItems: function (presentItems) {
    function recurse(popup, items, isTopLevel) {
      items.forEach(function (item) {
        let elt = this.getItemElt(popup, item);

        if (isTopLevel) {
          if (this.shouldOverflow(items)) {
            this.test.assert(!elt || elt.hidden,
                             "Item should not be present in top-level menu");

            let overflowPopup = this.overflowPopup;
            this.test.assert(overflowPopup,
                             "Overflow submenu should be present");

            elt = this.getItemElt(overflowPopup, item);
            this.test.assert(elt && !elt.hidden,
                             "Item should be present in overflow submenu");
          }
          else {
            this.test.assert(elt && !elt.hidden,
                             "Item should be present in top-level menu");
          }
        }
        else {
          this.test.assert(elt && !elt.hidden,
                           "Item should be present in menu");
        }

        this.checkItemElt(elt, item);
        if (this.getItemType(item) === "Menu")
          recurse.call(this, elt.firstChild, item.items, false);
      }, this);
    }

    recurse.call(this, this.contextMenuPopup, presentItems, true);
  },

  // Asserts that items that have been removed from the menu are really removed.
  checkRemovedItems: function (removedItems) {
    for (let i = 0; i < removedItems.length; i++) {
      let item = removedItems[i];

      let elt = this.getItemElt(this.contextMenuPopup, item);
      this.test.assert(!elt, "Item should be removed from top-level menu");

      let overflowPopup = this.overflowPopup;
      if (overflowPopup) {
        elt = this.getItemElt(overflowPopup, item);
        this.test.assert(!elt, "Item should be removed from overflow submenu");
      }
    }
  },

  // Asserts that the menu separator separating standard items from our items
  // looks OK.
  checkSeparator: function (presentItems) {
    let sep = this.contextMenuSeparator;
    if (presentItems.length) {
      this.test.assert(sep && !sep.hidden, "Menu separator should be present");
      this.test.assertEqual(sep.localName, "menuseparator",
                            "Menu separator should be a <menuseparator>");
    }
    else {
      this.test.assert(!sep || sep.hidden, "Menu separator should be absent");
    }
  },

  // Asserts that our items are sorted.
  checkSort: function (presentItems) {
    // Get the first item in sorted order, get its elt, walk the nextSibling
    // chain, making sure each is greater than the previous.
    if (presentItems.length) {
      let sorted = presentItems.slice(0).
                   sort(function (a, b) a.label.localeCompare(b.label));
      let elt = this.shouldOverflow(presentItems) ?
                this.getItemElt(this.overflowPopup, sorted[0]) :
                this.getItemElt(this.contextMenuPopup, sorted[0]);
      let numElts = 1;
      while (elt.nextSibling &&
             elt.nextSibling.className.split(/\s+/).indexOf(ITEM_CLASS) >= 0) {
        let eltLabel = elt.getAttribute("label");
        let nextLabel = elt.nextSibling.getAttribute("label");
        this.test.assert(eltLabel.localeCompare(nextLabel) < 0,
                         "Item label should be < next item's label");
        elt = elt.nextSibling;
        numElts++;
      }
      this.test.assertEqual(numElts, presentItems.length,
                            "The first item in sorted order should have the " +
                            "first element in sorted order");
    }
  },

  // Attaches an event listener to node.  The listener is automatically removed
  // when it's fired (so it's assumed it will fire), and callback is called
  // after a short delay.  Since the module we're testing relies on the same
  // event listeners to do its work, this is to give them a little breathing
  // room before callback runs.  Inside callback |this| is this object.
  delayedEventListener: function (node, event, callback, useCapture) {
    const self = this;
    node.addEventListener(event, function handler(evt) {
      node.removeEventListener(event, handler, useCapture);
      timer.setTimeout(function () {
        try {
          callback.call(self, evt);
        }
        catch (err) {
          self.test.exception(err);
          self.test.done();
        }
      }, 20);
    }, useCapture);
  },

  // Call to finish the test.
  done: function () {
    function commonDone() {
      if (this.tab) {
        this.tabBrowser.removeTab(this.tab);
        this.tabBrowser.selectedTab = this.oldSelectedTab;
      }
      while (this.loaders.length) {
        let browserManager = this.loaders[0].globalScope.browserManager;
        let topLevelItems = browserManager.topLevelItems.slice();
        let privatePropsKey = this.loaders[0].globalScope.PRIVATE_PROPS_KEY;
        let workerRegs = topLevelItems.map(function (item) {
          return item.valueOf(privatePropsKey)._workerReg;
        });

        this.loaders[0].unload();

        // Make sure the browser manager is cleaned up.
        this.test.assertEqual(browserManager.browserWins.length, 0,
                              "browserManager should have no windows left");
        this.test.assertEqual(browserManager.topLevelItems.length, 0,
                              "browserManager should have no items left");
        this.test.assert(!("contentWins" in browserManager),
                         "browserManager should have no content windows left");

        // Make sure the items' worker registries are cleaned up.
        topLevelItems.forEach(function (item) {
          this.test.assert(!("_workerReg" in item.valueOf(privatePropsKey)),
                           "item's worker registry should be removed");
        }, this);
        workerRegs.forEach(function (workerReg) {
          this.test.assertEqual(Object.keys(workerReg.winWorkers).length, 0,
                                "worker registry should be empty");
          this.test.assertEqual(
            Object.keys(workerReg.winsWithoutWorkers).length, 0,
            "worker registry list of windows without workers should be empty");
        }, this);
      }
      this.test.done();
    }

    function closeBrowserWindow() {
      if (this.oldBrowserWindow) {
        this.delayedEventListener(this.browserWindow, "unload", commonDone,
                                  false);
        this.browserWindow.close();
        this.browserWindow = this.oldBrowserWindow;
        delete this.oldBrowserWindow;
      }
      else {
        commonDone.call(this);
      }
    };

    if (this.contextMenuPopup.state == "closed") {
      closeBrowserWindow.call(this);
    }
    else {
      this.delayedEventListener(this.contextMenuPopup, "popuphidden",
                                function () closeBrowserWindow.call(this),
                                false);
      this.contextMenuPopup.hidePopup();
    }
  },

  // Returns the DOM element in popup corresponding to item.
  // WARNING: The element is found by comparing labels, so don't give two items
  // the same label.
  getItemElt: function (popup, item) {
    let nodes = popup.childNodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (this.getItemType(item) === "Separator") {
        if (nodes[i].localName === "menuseparator")
          return nodes[i];
      }
      else if (nodes[i].getAttribute("label") === item.label)
        return nodes[i];
    }
    return null;
  },

  // Returns "Item", "Menu", or "Separator".
  getItemType: function (item) {
    // Could use instanceof here, but that would require accessing the loader
    // that created the item, and I don't want to A) somehow search through the
    // this.loaders list to find it, and B) assume there are any live loaders at
    // all.
    return /^\[object (Item|Menu|Separator)/.exec(item.toString())[1];
  },

  // Returns a wrapper around a new loader: { loader, cm, unload, globalScope }.
  // loader is a Cuddlefish sandboxed loader, cm is the context menu module,
  // globalScope is the context menu module's global scope, and unload is a
  // function that unloads the loader and associated resources.
  newLoader: function () {
    const self = this;
    let loader = Loader(module);
    let wrapper = {
      loader: loader,
      cm: loader.require("context-menu"),
      globalScope: loader.sandbox("context-menu"),
      unload: function () {
        loader.unload();
        let idx = self.loaders.indexOf(wrapper);
        if (idx < 0)
          throw new Error("Test error: tried to unload nonexistent loader");
        self.loaders.splice(idx, 1);
      }
    };
    this.loaders.push(wrapper);
    return wrapper;
  },

  // Returns true if the number of presentItems crosses the overflow threshold.
  shouldOverflow: function (presentItems) {
    return presentItems.length >
           (this.loaders.length ?
            this.loaders[0].loader.require("preferences-service").
              get(OVERFLOW_THRESH_PREF, OVERFLOW_THRESH_DEFAULT) :
            OVERFLOW_THRESH_DEFAULT);
  },

  // Opens the context menu on the current page.  If targetNode is null, the
  // menu is opened in the top-left corner.  onShowncallback is passed the
  // popup.
  showMenu: function(targetNode, onshownCallback) {
    function sendEvent() {
      this.delayedEventListener(this.browserWindow, "popupshowing",
        function (e) {
          let popup = e.target;
          onshownCallback.call(this, popup);
        }, false);

      let rect = targetNode ?
                 targetNode.getBoundingClientRect() :
                 { left: 0, top: 0, width: 0, height: 0 };
      let contentWin = this.browserWindow.content;
      contentWin.
        QueryInterface(Ci.nsIInterfaceRequestor).
        getInterface(Ci.nsIDOMWindowUtils).
        sendMouseEvent("contextmenu",
                       rect.left + (rect.width / 2),
                       rect.top + (rect.height / 2),
                       2, 1, 0);
    }

    // If a new tab or window has not yet been opened, open a new tab now.  For
    // some reason using the tab already opened when the test starts causes
    // leaks.  See bug 566351 for details.
    if (!targetNode && !this.oldSelectedTab && !this.oldBrowserWindow) {
      this.oldSelectedTab = this.tabBrowser.selectedTab;
      this.tab = this.tabBrowser.addTab("about:blank");
      let browser = this.tabBrowser.getBrowserForTab(this.tab);

      this.delayedEventListener(browser, "load", function () {
        this.tabBrowser.selectedTab = this.tab;
        sendEvent.call(this);
      }, true);
    }
    else
      sendEvent.call(this);
  },

  // Opens a new browser window.  The window will be closed automatically when
  // done() is called.
  withNewWindow: function (onloadCallback) {
    let win = this.browserWindow.OpenBrowserWindow();
    this.delayedEventListener(win, "load", onloadCallback, true);
    this.oldBrowserWindow = this.browserWindow;
    this.browserWindow = win;
  },

  // Opens a new tab with our test page in the current window.  The tab will
  // be closed automatically when done() is called.
  withTestDoc: function (onloadCallback) {
    this.oldSelectedTab = this.tabBrowser.selectedTab;
    this.tab = this.tabBrowser.addTab(TEST_DOC_URL);
    let browser = this.tabBrowser.getBrowserForTab(this.tab);

    this.delayedEventListener(browser, "load", function () {
      this.tabBrowser.selectedTab = this.tab;
      onloadCallback.call(this, browser.contentWindow, browser.contentDocument);
    }, true);
  }
};
