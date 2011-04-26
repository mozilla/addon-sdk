/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Drew Willcoxon <adw@mozilla.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

let {Cc,Ci} = require("chrome");

// These should match the same constants in the module.
const ITEM_CLASS = "jetpack-context-menu-item";
const SEPARATOR_ID = "jetpack-context-menu-separator";
const OVERFLOW_THRESH_DEFAULT = 10;
const OVERFLOW_MENU_ID = "jetpack-content-menu-overflow-menu";
const OVERFLOW_POPUP_ID = "jetpack-content-menu-overflow-popup";

const TEST_DOC_URL = __url__.replace(/\.js$/, ".html");


// Destroying items that were previously created should cause them to be absent
// from the menu.
exports.testConstructDestroy = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  // Create an item.
  let item = new loader.cm.Item({ label: "item" });

  test.showMenu(null, function (popup) {

    // It should be present when the menu is shown.
    test.checkMenu([item], [], []);
    popup.hidePopup();

    // Destroy the item.
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
    contentScript: 'postMessage("ok");',
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
    let workerReg = item.valueOf(privatePropsKey).workerReg;

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
    contentScript: 'on("context", function () true);'
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
    contentScript: 'on("context", function () false);'
  });

  test.showMenu(null, function (popup) {
    test.checkMenu([], [item], []);
    test.done();
  });
};


// The args passed to context listeners should be correct.
exports.testContentContextArgs = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    contentScript: 'on("context", function (node) {' +
                   '  let Ci = Components.interfaces;' +
                   '  postMessage(node instanceof Ci.nsIDOMHTMLElement);' +
                   '  return false;' +
                   '});',
    onMessage: function (isElt) {
      test.assert(isElt, "node should be an HTML element");
      test.done();
    }
  });

  test.showMenu(null, function () {});
};


// Multiple contexts imply intersection, not union, and content context
// listeners should not be called if all declarative contexts are not current.
exports.testMultipleContexts = function (test) {
  test = new TestHelper(test);
  let loader = test.newLoader();

  let item = new loader.cm.Item({
    label: "item",
    context: [loader.cm.SelectorContext("a[href]"), loader.cm.PageContext()],
    contentScript: 'on("context", function () postMessage());',
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
    contentScript: 'on("click", function (node, data) {' +
                   '  let Ci = Components.interfaces;' +
                   '  postMessage({' +
                   '    isElt: node instanceof Ci.nsIDOMHTMLElement,' +
                   '    data: data' +
                   '  });' +
                   '});',
    onMessage: function (data) {
      test.assertEqual(this, item, "`this` inside onMessage should be item");
      test.assert(data.isElt, "node should be an HTML element");
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
  let test = new TestHelper(test);
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
    contentScript: 'on("click", function (node, data) {' +
                   '  let Ci = Components.interfaces;' +
                   '  postMessage({' +
                   '    isAnchor: node instanceof Ci.nsIDOMHTMLAnchorElement,' +
                   '    data: data' +
                   '  });' +
                   '});',
    onMessage: function (data) {
      test.assertEqual(this, topMenu, "`this` inside top menu should be menu");
      test.assert(data.isAnchor, "Clicked node should be anchor");
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

    // Get the menu element, makes sure it's OK.
    let menuElt = test.getItemElt(popup, menu);
    test.assert(menuElt, "Menu element should exist");

    // Get the separator element inside the menu's popup, makes sure it's OK.
    menuElt.open = true;
    let sepElt = menuElt.firstChild.firstChild;
    test.assert(sepElt, "Separator element should exist");
    test.assert(!sepElt.hidden, "Separator element should not be hidden");
    test.assertEqual(sepElt.localName, "menuseparator",
                     "Separator should be of expected type");
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
  test.assert(ip === null, "Insertion point should be null");

  ip = insertionPoint("a", mockElts(["b"]));
  test.assertEqual(ip.label, "b", "Insertion point should be 'b'");

  ip = insertionPoint("c", mockElts(["b"]));
  test.assert(ip === null, "Insertion point should be null");

  ip = insertionPoint("b", mockElts(["a", "c"]));
  test.assertEqual(ip.label, "c", "Insertion point should be 'c'");

  ip = insertionPoint("c", mockElts(["a", "b", "d"]));
  test.assertEqual(ip.label, "d", "Insertion point should be 'd'");

  ip = insertionPoint("a", mockElts(["b", "c", "d"]));
  test.assertEqual(ip.label, "b", "Insertion point should be 'b'");

  ip = insertionPoint("d", mockElts(["a", "b", "c"]));
  test.assert(ip === null, "Insertion point should be null");

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
                   'on("context", function () {' +
                   '  potato = "potato";' +
                   '  return true;' +
                   '});' +
                   'on("click", function () {' +
                   '  postMessage(potato);' +
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
      contentScript: 'on("click", function () postMessage("click"));',
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


// NO TESTS BELOW THIS LINE! ///////////////////////////////////////////////////

// Run only a dummy test if context-menu doesn't support the host app.
if (!require("xul-app").is("Firefox")) {
  for (let [prop, val] in Iterator(exports))
    if (/^test/.test(prop) && typeof(val) === "function")
      delete exports[prop];
  exports.testAppNotSupported = function (test) {
    test.pass("context-menu does not support this application.");
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
    this.test.assertEqual(elt.getAttribute("label"), item.label,
                          "Item should have correct title");
    if (item.data) {
      this.test.assertEqual(elt.getAttribute("value"), item.data,
                            "Item should have correct data");
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
    for (let i = 0; i < presentItems.length; i++) {
      let item = presentItems[i];
      let elt = this.getItemElt(this.contextMenuPopup, item);

      if (this.shouldOverflow(presentItems)) {
        this.test.assert(!elt || elt.hidden,
                         "Item should not be present in top-level menu");

        let overflowPopup = this.overflowPopup;
        this.test.assert(overflowPopup, "Overflow submenu should be present");

        elt = this.getItemElt(overflowPopup, item);
        this.test.assert(elt && !elt.hidden,
                         "Item should be present in overflow submenu");
      }
      else {
        this.test.assert(elt && !elt.hidden,
                         "Item should be present in top-level menu");
      }

      this.checkItemElt(elt, item);
    }
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
      require("timer").setTimeout(function () {
        try {
          callback.call(self, evt);
        }
        catch (err) {
          self.test.exception(err);
          self.test.done();
        }
      }, 10);
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
        let items = browserManager.items.slice();
        let privatePropsKey = this.loaders[0].globalScope.PRIVATE_PROPS_KEY;
        this.loaders[0].unload();

        // Make sure the browser manager is cleaned up.
        this.test.assertEqual(browserManager.windows.length, 0,
                              "browserManager should have no windows left");
        this.test.assertEqual(browserManager.items.length, 0,
                              "browserManager should have no items left");

        // Make sure the items' worker registries are cleaned up.
        items.forEach(function (item) {
          let workerReg = item.valueOf(privatePropsKey).workerReg;
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
      if (nodes[i].getAttribute("label") === item.label)
        return nodes[i];
    }
    return null;
  },

  // Returns a wrapper around a new loader: { loader, cm, unload, globalScope }.
  // loader is a Cuddlefish sandboxed loader, cm is the context menu module,
  // globalScope is the context menu module's global scope, and unload is a
  // function that unloads the loader and associated resources.
  newLoader: function () {
    const self = this;
    let loader = this.test.makeSandboxedLoader();
    let wrapper = {
      loader: loader,
      cm: loader.require("context-menu"),
      globalScope: loader.findSandboxForModule("context-menu").globalScope,
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
    return presentItems.length > OVERFLOW_THRESH_DEFAULT;
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
                 { left: 0, top: 0 };
      let contentWin = this.browserWindow.content;
      contentWin.
        QueryInterface(Ci.nsIInterfaceRequestor).
        getInterface(Ci.nsIDOMWindowUtils).
        sendMouseEvent("contextmenu", rect.left, rect.top, 2, 1, 0);
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
