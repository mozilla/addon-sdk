/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "stable"
};

const { Class, mix } = require("api-utils/heritage");
const { addCollectionProperty } = require("api-utils/collection");
const { ns } = require("api-utils/namespace");
const { validateOptions, getTypeOf } = require("api-utils/api-utils");
const { URL } = require("api-utils/url");
const { WindowTracker, browserWindowIterator } = require("api-utils/window-utils");
const { isBrowser } = require("api-utils/window/utils");
const { Ci } = require("chrome");
const { MatchPattern } = require("api-utils/match-pattern");
const { Worker } = require("api-utils/content/worker");
const { EventTarget } = require("api-utils/event/target");
const { emit } = require('api-utils/event/core');
const { when } = require('api-utils/unload');

// All user items we add have this class.
const ITEM_CLASS = "jetpack-context-menu-item";

// Items in the top-level context menu also have this class.
const TOPLEVEL_ITEM_CLASS = "jetpack-context-menu-item-toplevel";

// Items in the overflow submenu also have this class.
const OVERFLOW_ITEM_CLASS = "jetpack-context-menu-item-overflow";

// The class of the menu separator that separates standard context menu items
// from our user items.
const SEPARATOR_CLASS = "jetpack-context-menu-separator";

// If more than this number of items are added to the context menu, all items
// overflow into a "Jetpack" submenu.
const OVERFLOW_THRESH_DEFAULT = 10;
const OVERFLOW_THRESH_PREF =
  "extensions.addon-sdk.context-menu.overflowThreshold";

// The label of the overflow sub-xul:menu.
//
// TODO: Localize this.
const OVERFLOW_MENU_LABEL = "Add-ons";

// The class of the overflow sub-xul:menu.
const OVERFLOW_MENU_CLASS = "jetpack-content-menu-overflow-menu";

// The class of the overflow submenu's xul:menupopup.
const OVERFLOW_POPUP_CLASS = "jetpack-content-menu-overflow-popup";

//These are used by PageContext.isCurrent below. If the popupNode or any of
//its ancestors is one of these, Firefox uses a tailored context menu, and so
//the page context doesn't apply.
const NON_PAGE_CONTEXT_ELTS = [
  Ci.nsIDOMHTMLAnchorElement,
  Ci.nsIDOMHTMLAppletElement,
  Ci.nsIDOMHTMLAreaElement,
  Ci.nsIDOMHTMLButtonElement,
  Ci.nsIDOMHTMLCanvasElement,
  Ci.nsIDOMHTMLEmbedElement,
  Ci.nsIDOMHTMLImageElement,
  Ci.nsIDOMHTMLInputElement,
  Ci.nsIDOMHTMLMapElement,
  Ci.nsIDOMHTMLMediaElement,
  Ci.nsIDOMHTMLMenuElement,
  Ci.nsIDOMHTMLObjectElement,
  Ci.nsIDOMHTMLOptionElement,
  Ci.nsIDOMHTMLSelectElement,
  Ci.nsIDOMHTMLTextAreaElement,
];

// Holds private properties for API objects
let internal = ns();

let Context = Class({
  adjustPopupNode: function adjustPopupNode(popupNode) {
    return popupNode;
  },

  isCurrent: function isCurrent(popupNode) {
    return false;
  }
});

// Matches when the context-clicked node doesn't have any of
// NON_PAGE_CONTEXT_ELTS in its ancestors
exports.PageContext = Class({
  extends: Context,

  isCurrent: function isCurrent(popupNode) {
    if (!popupNode.ownerDocument.defaultView.getSelection().isCollapsed)
      return false;

    while (!(popupNode instanceof Ci.nsIDOMDocument)) {
      if (NON_PAGE_CONTEXT_ELTS.some(function(type) popupNode instanceof type))
        return false;

      popupNode = popupNode.parentNode;
    }

    return true;
  }
});

// Matches when there is an active selection in the window
exports.SelectionContext = Class({
  extends: Context,

  isCurrent: function isCurrent(popupNode) {
    if (!popupNode.ownerDocument.defaultView.getSelection().isCollapsed)
      return true;

    try {
      let { selectionStart, selectionEnd } = popupNode;
      return !isNaN(selectionStart) && !isNaN(selectionEnd) &&
             selectionStart !== selectionEnd;
    }
    catch (e) {
      return false;
    }
  }
});

// Matches when the context-clicked node or any of its ancestors matches the
// selector given
exports.SelectorContext = Class({
  extends: Context,

  initialize: function initialize(selector) {
    let options = validateOptions({ selector: selector }, {
      selector: {
        is: ["string"],
        msg: "selector must be a string."
      }
    });
    internal(this).selector = options.selector;
  },

  adjustPopupNode: function adjustPopupNode(popupNode) {
    let selector = internal(this).selector;

    while (!(popupNode instanceof Ci.nsIDOMDocument)) {
      if (popupNode.mozMatchesSelector(selector))
        return popupNode;

      popupNode = popupNode.parentNode;
    }

    return null;
  },

  isCurrent: function isCurrent(popupNode) {
    return !!this.adjustPopupNode(popupNode);
  }
});

// Matches when the page url matches any of the patterns given
exports.URLContext = Class({
  extends: Context,

  initialize: function initialize(patterns) {
    patterns = Array.isArray(patterns) ? patterns : [patterns];

    try {
      internal(this).patterns = patterns.map(function (p) new MatchPattern(p));
    }
    catch (err) {
      console.error("patterns must be a string, regexp or an array of strings or regexps");
      throw err;
    }

  },

  isCurrent: function isCurrent(popupNode) {
    let url = popupNode.ownerDocument.URL;
    return internal(this).patterns.some(function (p) p.test(url));
  }
});

function filterOut(array, item) {
  return array.filter(function(i) i !== item);
}

// Shared option validation rules for Item and Menu
let baseItemRules = {
  parentMenu: {
    is: ["object", "undefined"],
    ok: function (v) {
      if (!v)
        return true;
      return (v instanceof ItemContainer) || (v instanceof Menu);
    },
    msg: "parentMenu is specified must be a Menu."
  },
  context: {
    is: ["undefined", "object", "array"],
    ok: function (v) {
      if (!v)
        return true;
      let arr = Array.isArray(v) ? v : [v];
      return arr.every(function (o) o instanceof Context);
    },
    msg: "The 'context' option must be a Context object or an array of " +
         "Context objects."
  },
  contentScript: {
    is: ["string", "array", "undefined"],
    ok: function (v) {
      return !Array.isArray(v) ||
             v.every(function (s) typeof(s) === "string");
    }
  },
  contentScriptFile: {
    is: ["string", "array", "undefined"],
    ok: function (v) {
      if (!v)
        return true;
      let arr = Array.isArray(v) ? v : [v];
      try {
        return arr.every(function (s) {
          return getTypeOf(s) === "string" &&
                 URL(s).scheme === 'resource';
        });
      }
      catch (err) {}
      return false;
    },
    msg: "The 'contentScriptFile' option must be a local file URL or " +
         "an array of local file URLs."
  },
  onMessage: {
    is: ["function", "undefined"]
  }
};

let labelledItemRules =  mix(baseItemRules, {
  label: {
    map: function (v) v.toString(),
    is: ["string"],
    ok: function (v) !!v,
    msg: "The item must have a non-empty string label."
  },
  image: {
    map: function (v) v.toString(),
    is: ["string", "undefined", "null"]
  }
});

// Additional validation rules for Item
let itemRules = mix(labelledItemRules, {
  data: {
    map: function (v) v.toString(),
    is: ["string", "undefined"]
  }
});

// Additional validation rules for Menu
let menuRules = mix(labelledItemRules, {
  items: {
    is: ["array", "undefined"],
    ok: function (v) {
      if (!v)
        return true;
      return v.every(function (item) {
        return item instanceof BaseItem;
      });
    },
    msg: "items must be an array, and each element in the array must be an " +
         "Item, Menu, or Separator."
  }
});

let ContextWorker = Worker.compose({
  // Returns the first string or truthy value returned by a context listener in
  // the worker's port. If none return a string or truthy value or if there are
  // no context listeners, returns false. popupNode is the node that was
  // context-clicked.
  isAnyContextCurrent: function isAnyContextCurrent(popupNode) {
    let results = this._contentWorker.emitSync("context", popupNode);
    if (results.length == 0)
      return true;
    for (let i = 0; i < results.length; i++) {
      let val = results[i];
      if (typeof val === "string" || val)
        return val;
    }
    return false;
  },

  // Emits a click event in the worker's port. popupNode is the node that was
  // context-clicked, and clickedItemData is the data of the item that was
  // clicked.
  fireClick: function fireClick(popupNode, clickedItemData) {
    this._contentWorker.emitSync("click", popupNode, clickedItemData);
  }
});

// Tests whether an item should be visible or not based on its contexts and
// content scripts
function isItemVisible(item, popupNode) {
  if (item.context.length > 0) {
    for (let context in item.context) {
      if (!context.isCurrent(popupNode))
        return false;
    }
  }
  else {
    let context = exports.PageContext();
    if (!context.isCurrent(popupNode))
      return false;
  }

  let worker = getItemWorkerForWindow(item, popupNode.ownerDocument.defaultView);
  if (!worker)
    return true;

  let result = worker.isAnyContextCurrent(popupNode);
  if (typeof result === "string")
    item.label = result;
  else if (result === false)
    return false;

  return true;
}

// Destroys any item's content scripts workers associated with the given window
function destroyItemWorker(item, window) {
  let worker = internal(item).workerMap.get(window);
  if (worker)
    worker.destroy();

  internal(item).workerWindows = filterOut(internal(item).workerWindows, window);
}

// Gets the item's content script worker for a window, creating one if necessary
// Once created it will be automatically destroyed when the window unloads.
// If there is not content scripts for the item then null will be returned.
function getItemWorkerForWindow(item, window) {
  if (!item.contentScript && !item.contentScriptFile)
    return null;

  let worker = internal(item).workerMap.get(window);

  if (worker)
    return worker;

  worker = ContextWorker({
    window: window,
    contentScript: item.contentScript,
    contentScriptFile: item.contentScriptFile,
    onError: function (err) console.exception(err),
    onMessage: function(msg) {
      emit(item, "message", msg);
    },
    onDetach: function() {
      destroyItemWorker(item, window);
    }
  });

  internal(item).workerMap.set(window, worker);
  internal(item).workerWindows.push(window);

  return worker;
}

// Called when an item is clicked to send out click events to the content
// scripts
function itemClicked(item, clickedItem, popupNode) {
  try {
  let worker = getItemWorkerForWindow(item, popupNode.ownerDocument.defaultView);

  if (worker) {
    let node = popupNode;
    for (let context in item.context)
      node = context.adjustPopupNode(node);

    worker.fireClick(node, clickedItem.data);
  }

  if (item.parentMenu)
    itemClicked(item.parentMenu, clickedItem, popupNode);
  }
  catch (e) {
    console.exception(e);
  }
}

// All things that appear in the context menu extend this
let BaseItem = Class({
  initialize: function initialize() {
    addCollectionProperty(this, "context");

    // Used to cache content script workers and the windows they have been
    // created for
    internal(this).workerMap = new WeakMap();
    internal(this).workerWindows = [];

    if ("context" in internal(this).options && internal(this).options.context) {
      let contexts = internal(this).options.context;
      if (Array.isArray(contexts)) {
        for (let context of contexts)
          this.context.add(context);
      }
      else {
        this.context.add(contexts);
      }
    }

    let parentMenu = internal(this).options.parentMenu;
    if (!parentMenu)
      parentMenu = exports.contentContextMenu;

    parentMenu.addItem(this);
  },

  destroy: function destroy() {
    if (internal(this).parentMenu)
      internal(this).parentMenu.removeItem(this);
  },

  get parentMenu() {
    return internal(this).parentMenu;
  },

  get contentScript() {
    return internal(this).options.contentScript;
  },

  get contentScriptFile() {
    return internal(this).options.contentScriptFile;
  }
});

// All things that have a label on the context menu extend this
let LabelledItem = Class({
  extends: BaseItem,
  implements: [ EventTarget ],

  initialize: function initialize(options) {
    BaseItem.prototype.initialize.call(this);
    EventTarget.prototype.initialize.call(this, options);
  },

  destroy: function destroy() {
    for (let window of internal(this).workerWindows)
      destroyItemWorker(this, window);
    internal(this).workerWindows = [];

    BaseItem.prototype.destroy.call(this);
  },

  get label() {
    return internal(this).options.label;
  },

  set label(val) {
    internal(this).options.label = val;

    MenuManager.updateItem(this);
  },

  get image() {
    return internal(this).options.image;
  },

  set image(val) {
    internal(this).options.image = val;

    MenuManager.updateItem(this);
  },

  get data() {
    return internal(this).options.data;
  },

  set data(val) {
    internal(this).options.data = val;
  }
});

let Item = Class({
  extends: LabelledItem,

  initialize: function initialize(options) {
    internal(this).options = validateOptions(options, itemRules);

    LabelledItem.prototype.initialize.call(this, options);
  },

  toString: function toString() {
    return "[object Item \"" + this.label + "\"]";
  },

  get data() {
    return internal(this).options.data;
  },

  set data(val) {
    internal(this).options.data = val;

    MenuManager.updateItem(this);
  },
});

let ItemContainer = Class({
  initialize: function initialize() {
    internal(this).children = [];
  },

  destroy: function destroy() {
    // Destroys the entire hierarchy
    for (let item of internal(this).children)
      item.destroy();
  },

  addItem: function addItem(item) {
    let oldParent = internal(item).parentMenu;

    // Don't just call removeItem here as that would remove the corresponding
    // UI element which is more costly than just moving it to the right place
    if (oldParent)
      internal(oldParent).children = filterOut(internal(oldParent).children, item);

    let after = null;
    let children = internal(this).children;
    if (children.length > 0)
      after = children[children.length - 1];

    children.push(item);
    internal(item).parentMenu = this;

    // If there was an old parent then we just have to move the item, otherwise
    // it needs to be created
    if (oldParent)
      MenuManager.moveItem(item, after);
    else
      MenuManager.createItem(item, after);
  },

  removeItem: function removeItem(item) {
    // If the item isn't a child of this menu then ignore this call
    if (internal(item).parentMenu !== this)
      return;

    MenuManager.removeItem(item);

    internal(this).children = filterOut(internal(this).children, item);
    internal(item).parentMenu = null;
  },

  get items() {
    return internal(this).children.slice(0);
  },

  set items(val) {
    // Validate the arguments before making any changes
    if (!Array.isArray(val))
      throw new Error(menuOptionRules.items.msg);

    for (let item of val) {
      if (!(item instanceof BaseItem))
        throw new Error(menuOptionRules.items.msg);
    }

    // Remove the old items and add the new ones
    for (let item of internal(this).children)
      this.removeItem(item);

    for (let item of val)
      this.addItem(item);
  },
});

let Menu = Class({
  extends: LabelledItem,
  implements: [ItemContainer],

  initialize: function initialize(options) {
    internal(this).options = validateOptions(options, menuRules);

    LabelledItem.prototype.initialize.call(this, options);
    ItemContainer.prototype.initialize.call(this);

    if (internal(this).options.items) {
      for (let item of internal(this).options.items)
        this.addItem(item);
    }
  },

  destroy: function destroy() {
    ItemContainer.prototype.destroy.call(this);
    LabelledItem.prototype.destroy.call(this);
  },

  toString: function toString() {
    return "[object Menu \"" + this.label + "\"]";
  },
});

let Separator = Class({
  extends: BaseItem,

  initialize: function initialize(options) {
    internal(this).options = validateOptions(options, baseItemRules);

    BaseItem.prototype.initialize.call(this);
  },

  toString: function toString() {
    return "[object Separator]";
  }
});

exports.Item = Item;
exports.Menu = Menu;
exports.Separator = Separator;

// Holds items for the content area context menu
exports.contentContextMenu = ItemContainer();
// Holds items for the tab context menu
exports.tabContextMenu = ItemContainer();

when(function() {
  exports.contentContextMenu.destroy();
  exports.tabContextMenu.destroy();
});

// App specific UI code lives here, it should handle populating the context
// menu and passing clicks etc. through to the items.

let MenuWrapper = Class({
  initialize: function initialize(winWrapper, items, contextMenu) {
    this.winWrapper = winWrapper;
    this.window = winWrapper.window;
    this.items = items;
    this.contextMenu = contextMenu;
    this.populated = false;
    this.menuMap = new WeakMap();

    this.contextMenu.addEventListener("popupshowing", this, false);
  },

  destroy: function destroy() {
    this.contextMenu.removeEventListener("popupshowing", this, false);

    if (!this.populated)
      return;

    // If we're getting unloaded at runtime then we must remove all the
    // generated XUL nodes
    let oldParent = null;
    for (let item of internal(this.items).children) {
      let xulNode = this.getXULNodeForItem(item);
      oldParent = xulNode.parentNode;
      oldParent.removeChild(xulNode);
    }

    if (oldParent)
      this.onXULRemoved(oldParent);
  },

  get separator() {
    return this.contextMenu.querySelector("." + SEPARATOR_CLASS);
  },

  get overflowMenu() {
    return this.contextMenu.querySelector("." + OVERFLOW_MENU_CLASS);
  },

  get overflowPopup() {
    return this.contextMenu.querySelector("." + OVERFLOW_POPUP_CLASS);
  },

  get topLevelItems() {
    return this.contextMenu.querySelectorAll("." + TOPLEVEL_ITEM_CLASS);
  },

  get overflowItems() {
    return this.contextMenu.querySelectorAll("." + OVERFLOW_ITEM_CLASS + " > ." + ITEM_CLASS);
  },

  getXULNodeForItem: function getXULNodeForItem(item) {
    return this.menuMap.get(item);
  },

  // Recurses through the item hierarchy creating XUL nodes for everything
  populate: function populate(menu) {
    for (let i = 0; i < internal(menu).children.length; i++) {
      let item = internal(menu).children[i];
      let after = i === 0 ? null : internal(menu).children[i - 1];
      this.createItem(item, after);

      if (item instanceof Menu)
        this.populate(item);
    }
  },

  // Recurses through the menu setting the visibility of items. Returns true
  // if any of the items in this menu were visible
  setVisibility: function setVisibility(menu, popupNode) {
    let anyVisible = false;

    for (let item of internal(menu).children) {
      let visible = isItemVisible(item, popupNode);

      // Recurse through Menus, if none of the sub-items were visible then the
      // menu is hidden too.
      if (visible && (item instanceof Menu))
        visible = this.setVisibility(item, popupNode);

      let xulNode = this.getXULNodeForItem(item);
      xulNode.hidden = !visible;

      anyVisible = anyVisible || visible;
    }

    return anyVisible;
  },

  // Works out where to insert a XUL node for an item in a browser window
  insertIntoXUL: function insertIntoXUL(item, node, after) {
    let menupopup = null;
    let before = null;

    let menu = internal(item).parentMenu;
    if (menu === this.items) {
      menupopup = this.overflowPopup;

      // If there isn't already an overflow menu then check if we need to
      // create one, otherwise use the main context menu
      if (!menupopup) {
        menupopup = this.contextMenu;
        let toplevel = this.topLevelItems;

        if (toplevel.length >= MenuManager.overflowThreshold) {
          // Create the overflow menu and move everything there
          let overflowMenu = this.window.document.createElement("menu");
          overflowMenu.setAttribute("class", OVERFLOW_MENU_CLASS);
          overflowMenu.setAttribute("label", OVERFLOW_MENU_LABEL);
          this.contextMenu.insertBefore(overflowMenu, this.separator.nextSibling);

          menupopup = this.window.document.createElement("menupopup");
          menupopup.setAttribute("class", OVERFLOW_POPUP_CLASS);
          overflowMenu.appendChild(menupopup);

          for (let xulNode of toplevel) {
            menupopup.appendChild(xulNode);
            this.setXULClass(xulNode);
          }
        }
      }
    }
    else {
      let xulNode = this.getXULNodeForItem(menu);
      menupopup = xulNode.firstChild;
    }

    if (after) {
      let afterNode = this.getXULNodeForItem(after);
      before = afterNode.nextSibling;
    }
    else if (menupopup === this.contextMenu) {
      let topLevel = this.topLevelItems;
      if (topLevel.length > 0)
        before = topLevel[topLevel.length - 1].nextSibling;
      else
        before = this.separator.nextSibling;
    }

    menupopup.insertBefore(node, before);
  },

  // Sets the right class for XUL nodes
  setXULClass: function setXULClass(xulNode) {
    let cls = ITEM_CLASS;

    if (xulNode.parentNode == this.contextMenu)
      cls += " " + TOPLEVEL_ITEM_CLASS;

    if (xulNode.parentNode == this.overflowPopup)
      cls += " " + OVERFLOW_ITEM_CLASS;

    xulNode.className = cls;
  },

  // Creates a XUL node for an item
  createItem: function createItem(item, after) {
    if (!this.populated)
      return;

    // Create the separator if it doesn't already exist
    if (!this.separator) {
      let separator = this.window.document.createElement("menuseparator");
      separator.setAttribute("class", SEPARATOR_CLASS);
      this.contextMenu.appendChild(separator);
    }

    let type = "menuitem";
    if (item instanceof Menu)
      type = "menu";
    else if (item instanceof Separator)
      type = "menuseparator";

    let xulNode = this.window.document.createElement(type);
    if (item instanceof LabelledItem) {
      xulNode.setAttribute("label", item.label);
      if (item.image)
        xulNode.setAttribute("image", item.image);
      if (item.data)
        xulNode.setAttribute("value", item.data);

      let self = this;
      xulNode.addEventListener("click", function(event) {
        // Only care about clicks directly on this item
        if (event.target !== xulNode)
          return;

        itemClicked(item, item, self.contextMenu.triggerNode);
      }, false);
    }

    this.insertIntoXUL(item, xulNode, after);
    this.setXULClass(xulNode);
    xulNode.data = item.data;

    if (item instanceof Menu) {
      let menupopup = this.window.document.createElement("menupopup");
      xulNode.appendChild(menupopup);
    }

    this.menuMap.set(item, xulNode);
  },

  // Updates the XUL node for an item in this window
  updateItem: function updateItem(item) {
    if (!this.populated)
      return;

    let xulNode = this.getXULNodeForItem(item);

    // TODO figure out why this requires setAttribute
    xulNode.setAttribute("label", item.label);
    if (item.image)
      xulNode.setAttribute("image", item.image);
    else
      xulNode.removeAttribute("image");
    if (item.data)
      xulNode.setAttribute("value", item.data);
    else
      xulNode.removeAttribute("value");
  },

  // Moves the XUL node for an item in this window to its new place in the
  // hierarchy
  moveItem: function moveItem(item, after) {
    if (!this.populated)
      return;

    let xulNode = this.getXULNodeForItem(item);
    let oldParent = xulNode.parentNode;

    this.insertIntoXUL(item, xulNode, after);
    this.setXULClass(xulNode);
    this.onXULRemoved(oldParent);
  },

  // Removes the XUL nodes for an item in every window we've ever populated.
  removeItem: function removeItem(item) {
    if (!this.populated)
      return;

    let xulItem = this.getXULNodeForItem(item);

    let oldParent = xulItem.parentNode;

    oldParent.removeChild(xulItem);
    this.menuMap.delete(item);

    this.onXULRemoved(oldParent);
  },

  // Called when any XUL nodes have been removed from a menupopup. This handles
  // making sure the separator and overflow are correct
  onXULRemoved: function onXULRemoved(parent) {
    if (parent == this.contextMenu) {
      let toplevel = this.topLevelItems;

      // If there are no more items then remove the separator
      if (toplevel.length == 0) {
        let separator = this.separator;
        if (separator)
          separator.parentNode.removeChild(separator);
      }
    }
    else if (parent == this.overflowPopup) {
      if (parent.childNodes.length == 0) {
        // It's possible that this add-on had all the items in the overflow
        // menu and they're now all gone, so remove the separator and overflow
        // menu directly

        let separator = this.separator;
        separator.parentNode.removeChild(separator);
        this.contextMenu.removeChild(parent.parentNode);
      }
      else if (parent.childNodes.length <= MenuManager.overflowThreshold) {
        // Otherwise if the overflow menu is empty enough move everything in
        // the overflow menu back to top level and remove the overflow menu

        while (parent.firstChild) {
          let node = parent.firstChild;
          this.contextMenu.insertBefore(node, parent.parentNode);
          this.setXULClass(node);
        }
        this.contextMenu.removeChild(parent.parentNode);
      }
    }
  },

  handleEvent: function handleEvent(event) {
    try {
      if (event.type != "popupshowing")
        return;
      if (event.target != this.contextMenu)
        return;

      if (internal(this.items).children.length == 0)
        return;

      if (!this.populated) {
        this.populated = true;
        this.populate(this.items);
      }

      let separator = this.separator;
      let popup = this.overflowMenu;
  
      if (this.setVisibility(this.items, event.target.triggerNode)) {
        // Some of this instance's items are visible so make sure the separator
        // and if necessary the overflow popup are visible
        separator.hidden = false;
        if (popup)
          popup.hidden = false;
      }
      else {
        // We need to test whether any other instance has visible items.
        // Get all the highest level items and see if any are visible.
        let anyVisible = (Array.some(this.topLevelItems, function(item) !item.hidden)) ||
                         (Array.some(this.overflowItems, function(item) !item.hidden));
  
        // If any were visible make sure the separator and if necessary the
        // overflow popup are visible, otherwise hide them
        separator.hidden = !anyVisible;
        if (popup)
          popup.hidden = !anyVisible;
      }
    }
    catch (e) {
      console.exception(e);
    }
  }
});

// This wraps every window that we've seen
let WindowWrapper = Class({
  initialize: function initialize(window) {
    this.window = window;
    this.menus = [
      new MenuWrapper(this, exports.contentContextMenu, window.document.getElementById("contentAreaContextMenu")),
      new MenuWrapper(this, exports.tabContextMenu, window.document.getElementById("tabContextMenu")),
    ];
  },

  destroy: function destroy() {
    for (let menuWrapper of this.menus)
      menuWrapper.destroy();
  },

  getMenuWrapperForItem: function getMenuWrapperForItem(item) {
    let root = item.parentMenu;
    while (root.parentMenu)
      root = root.parentMenu;

    for (let wrapper of this.menus) {
      if (wrapper.items === root)
        return wrapper;
    }

    return null;
  }
});

let MenuManager = {
  windowMap: new WeakMap(),
  windows: [],

  get overflowThreshold() {
    let prefs = require("api-utils/preferences-service");
    return prefs.get(OVERFLOW_THRESH_PREF, OVERFLOW_THRESH_DEFAULT);
  },

  // When a new window is added start watching it for context menu shows
  onTrack: function onTrack(window) {
    if (!isBrowser(window))
      return;

    // Generally shouldn't happen, but just in case
    if (this.windowMap.has(window)) {
      console.warn("Already seen this window");
      return;
    }

    let winWrapper = WindowWrapper(window);
    this.windows.push(window);
    this.windowMap.set(window, winWrapper);
  },

  onUntrack: function onUntrack(window) {
    if (!isBrowser(window))
      return;

    let winWrapper = this.windowMap.get(window);
    // This shouldn't happen but protect against it anyway
    if (!winWrapper)
      return;
    winWrapper.destroy();

    this.windowMap.delete(window);
    this.windows = filterOut(this.windows, window);
  },

  // Creates a XUL node for an item in every window we've already populated
  createItem: function createItem(item, after) {
    for (let window of this.windows) {
      let winWrapper = this.windowMap.get(window);
      let menuWrapper = winWrapper.getMenuWrapperForItem(item);
      if (menuWrapper)
        menuWrapper.createItem(item, after);
    }
  },

  // Updates the XUL node for an item in every window we've already populated
  updateItem: function updateItem(item) {
    for (let window of this.windows) {
      let winWrapper = this.windowMap.get(window);
      let menuWrapper = winWrapper.getMenuWrapperForItem(item);
      if (menuWrapper)
        menuWrapper.updateItem(item);
    }
  },

  // Moves the XUL node for an item in every window we've ever populated to its
  // new place in the hierarchy
  moveItem: function moveItem(item, after) {
    for (let window of this.windows) {
      let winWrapper = this.windowMap.get(window);
      let menuWrapper = winWrapper.getMenuWrapperForItem(item);
      if (menuWrapper)
        menuWrapper.moveItem(item, after);
    }
  },

  // Removes the XUL nodes for an item in every window we've ever populated.
  removeItem: function removeItem(item) {
    for (let window of this.windows) {
      let winWrapper = this.windowMap.get(window);
      let menuWrapper = winWrapper.getMenuWrapperForItem(item);
      if (menuWrapper)
        menuWrapper.removeItem(item);
    }
  }
};

WindowTracker(MenuManager);
