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

// All user items we add have this class name.
const ITEM_CLASS = "jetpack-context-menu-item";

// Items in the top-level context menu also have this class.
const TOPLEVEL_ITEM_CLASS = "jetpack-context-menu-item-toplevel";

// Items in the overflow submenu also have this class.
const OVERFLOW_ITEM_CLASS = "jetpack-context-menu-item-overflow";

// The ID of the menu separator that separates standard context menu items from
// our user items.
const SEPARATOR_ID = "jetpack-context-menu-separator";

// If more than this number of items are added to the context menu, all items
// overflow into a "Jetpack" submenu.
const OVERFLOW_THRESH_DEFAULT = 10;
const OVERFLOW_THRESH_PREF =
  "extensions.addon-sdk.context-menu.overflowThreshold";

// The label of the overflow sub-xul:menu.
//
// TODO: Localize this.
const OVERFLOW_MENU_LABEL = "Add-ons";

// The ID of the overflow sub-xul:menu.
const OVERFLOW_MENU_ID = "jetpack-content-menu-overflow-menu";

// The ID of the overflow submenu's xul:menupopup.
const OVERFLOW_POPUP_ID = "jetpack-content-menu-overflow-popup";

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

    let { selectionStart, selectionEnd } = popupNode;
    return !isNaN(selectionStart) && !isNaN(selectionEnd) &&
           selectionStart !== selectionEnd;
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
let optionRules =  {
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
  label: {
    map: function (v) v.toString(),
    is: ["string"],
    ok: function (v) !!v,
    msg: "The item must have a non-empty string label."
  },
  image: {
    map: function (v) v.toString(),
    is: ["string", "undefined", "null"]
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

// Additional validation rules for Item
let itemOptionRules = mix(optionRules, {
  data: {
    map: function (v) v.toString(),
    is: ["string", "undefined"]
  }
});

// Additional validation rules for Menu
let menuOptionRules = mix(optionRules, {
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
  if (!(item instanceof LabelledItem))
    return true;

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

  window.removeEventListener("unload", internal(item).unloadListener, false);
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
    }
  });

  internal(item).workerMap.set(window, worker);
  internal(item).workerWindows.push(window);

  // Might want to just destroy if unused for 60 seconds
  window.addEventListener("unload", internal(item).unloadListener, false);

  return worker;
}

// Called when an item is clicked to send out click events to the content
// scripts
function itemClicked(item, clickedItem, popupNode) {
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

// All things that appear in the context menu extend this
let BaseItem = Class({
  initialize: function initialize() {
    // The only time rootMenu is undefined is when we're actually initializing
    // it
    if (!rootMenu)
      return;

    rootMenu.addItem(this);
  },

  destroy: function destroy() {
    if (internal(this).parentMenu)
      internal(this).parentMenu.removeItem(this);
  },

  get parentMenu() {
    let parent = internal(this).parentMenu;
    // Hide the root menu from the public hierarchy
    if (parent === rootMenu)
      return null;
    return parent;
  }
});

// All things that have a label on the context menu extend this
let LabelledItem = Class({
  extends: BaseItem,
  implements: [ EventTarget ],

  initialize: function initialize(options) {
    addCollectionProperty(this, "context");

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

    // Used to cache content script workers and the windows they have been
    // created for
    internal(this).workerMap = new WeakMap();
    internal(this).workerWindows = [];

    let self = this;
    internal(this).unloadListener = function(event) {
      destroyItemWorker(self, event.target.defaultView);
    };

    BaseItem.prototype.initialize.call(this);
    EventTarget.prototype.initialize.call(this, options);
  },

  destroy: function destroy() {
    for (let window of internal(this).workerWindows)
      destroyItemWorker(this, window);

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
  },
  
  get contentScript() {
    return internal(this).options.contentScript;
  },
  
  get contentScriptFile() {
    return internal(this).options.contentScriptFile;
  }
});

let Item = Class({
  extends: LabelledItem,

  initialize: function initialize(options) {
    internal(this).options = validateOptions(options, itemOptionRules);

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

let Menu = Class({
  extends: LabelledItem,

  initialize: function initialize(options) {
    internal(this).options = validateOptions(options, menuOptionRules);

    LabelledItem.prototype.initialize.call(this, options);

    internal(this).children = [];

    if (internal(this).options.items) {
      for (let item of internal(this).options.items)
        this.addItem(item);
    }
  },

  destroy: function destroy() {
    // Destroys the entire hierarchy
    for (let item of internal(this).children)
      item.destroy();

    LabelledItem.prototype.destroy.call(this);
  },

  addItem: function addItem(item) {
    let oldParent = internal(item).parentMenu;
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

    internal(this).children = filterOut(internal(this).children, item);
    internal(item).parentMenu = null;

    MenuManager.removeItem(item);
  },

  toString: function toString() {
    return "[object Menu \"" + this.label + "\"]";
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

let Separator = Class({
  extends: BaseItem,

  toString: function toString() {
    return "[object Separator]";
  }
});

exports.Item = Item;
exports.Menu = Menu;
exports.Separator = Separator;

// An internal menu to hold the root context items. It should never be reachable
// by API consumers
let rootMenu = Menu({
  label: OVERFLOW_MENU_LABEL
});

// App specific UI code lives here, it should handle populating the context
// menu and passing clicks etc. through to the items.
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

    let menu = window.document.getElementById("contentAreaContextMenu");
    menu.addEventListener("popupshowing", this, false);
  },

  onUntrack: function onUntrack(window) {
    if (!isBrowser(window))
      return;

    let menu = window.document.getElementById("contentAreaContextMenu");
    menu.removeEventListener("popupshowing", this, false);

    // If this window hasn't been populated then no point doing anything more
    if (!this.windowMap.has(window))
      return;

    // If we're getting unloaded at runtime then we must remove all the
    // generated XUL nodes
    for (let item of internal(rootMenu).children) {
      let xulNode = this.getXULNodeForItem(window, item);
      xulNode.parentNode.removeChild(xulNode);
    }

    // If there's an overflow menu then that is where we removed everything from
    // otherwise it was from the main context menu
    let oldParent = window.document.getElementById(OVERFLOW_POPUP_ID);
    if (!oldParent)
      oldParent = menu;
    this.onXULRemoved(oldParent);

    this.windowMap.delete(window);
    this.windows = filterOut(this.windows, window);
  },

  // Called when any XUL nodes have been removed from a menupopup. This handles
  // making sure the separator and overflow are correct
  onXULRemoved: function onXULRemoved(parent) {
    let window = parent.ownerDocument.defaultView;

    if (parent.id == "contentAreaContextMenu") {
      let toplevel = window.document.querySelectorAll("." + TOPLEVEL_ITEM_CLASS);

      // If there are no more items then remove the separator
      if (toplevel.length == 0) {
        let separator = window.document.getElementById(SEPARATOR_ID);
        if (separator)
          separator.parentNode.removeChild(separator);
      }
    }
    else if (parent.id == OVERFLOW_POPUP_ID) {
      if (parent.childNodes.length == 0) {
        // It's possible that this add-on had all the items in the overflow
        // menu and they're now all gone, so remove the separator and overflow
        // menu directly

        let separator = window.document.getElementById(SEPARATOR_ID);
        separator.parentNode.removeChild(separator);
        parent.parentNode.parentNode.removeChild(parent.parentNode);
      }
      else if (parent.childNodes.length <= this.overflowThreshold) {
        // Otherwise if the overflow menu is empty enough move everything in
        // the overflow menu back to top level and remove the overflow menu

        let context = window.document.getElementById("contentAreaContextMenu");
        while (parent.firstChild) {
          let node = parent.firstChild;
          context.insertBefore(node, parent.parentNode);
          this.setClass(node);
        }
        context.removeChild(parent.parentNode);
      }
    }
  },

  // Recurses through the menu setting the visibility of items. Returns true
  // if any of the items in this menu were visible
  setVisibility: function setVisibility(window, menu, popupNode) {
    let anyVisible = false;

    for (let item of internal(menu).children) {
      let visible = isItemVisible(item, popupNode);

      // Recurse through Menus, if none of the sub-items were visible then the
      // menu is hidden too.
      if (visible && (item instanceof Menu))
        visible = this.setVisibility(window, item, popupNode);

      let xulNode = this.getXULNodeForItem(window, item);
      xulNode.hidden = !visible;

      anyVisible = anyVisible || visible;
    }

    return anyVisible;
  },

  // Recurses through the item hierarchy creating XUL nodes for everything
  populateWindow: function populateWindow(window, menu) {
    for (let item of internal(menu).children) {
      MenuManager.createItemInWindow(window, item);

      if (item instanceof Menu)
        this.populateWindow(window, item);
    }
  },

  // Called when the context menu appears
  handleEvent: function handleEvent(event) {
    try {
      if (event.type != "popupshowing")
        return;
      if (event.target.id != "contentAreaContextMenu")
        return;
  
      let window = event.target.ownerDocument.defaultView;
  
      // If we've never seen the context menu for this browser window then
      // populate it with all the items we know about
      if (!this.windowMap.has(window)) {
        this.windows.push(window);
        this.windowMap.set(window, {
          menuMap: new WeakMap()
        });
  
        this.populateWindow(window, rootMenu);
      }

      let separator = window.document.getElementById(SEPARATOR_ID);
      let popup = window.document.getElementById(OVERFLOW_MENU_ID);

      if (this.setVisibility(window, rootMenu, event.target.triggerNode)) {
        // Some of this instance's items are visible so make sure the separator
        // and if necessary the overflow popup are visible
        separator.hidden = false;
        if (popup)
          popup.hidden = false;
      }
      else {
        // We need to test whether any other instance has visible items.
        // Get all the highest level items and see if any are visible.
        let topLevelSelector = "." + TOPLEVEL_ITEM_CLASS + ", ." + OVERFLOW_ITEM_CLASS + " > ." + ITEM_CLASS;
        let topLevelItems = window.document.querySelectorAll(topLevelSelector);

        let visible = false;
        for (let item of topLevelItems) {
          if (!item.hidden)
            visible = true;
        }

        // If any were visible make sure the separator and if necessary the
        // overflow popup are visible, otherwise hide them
        if (separator)
          separator.hidden = !visible;
        if (popup)
          popup.hidden = !visible;
      }
    }
    catch (e) {
      console.exception(e);
    }
  },

  // Sets the right class for XUL nodes
  setClass: function setClass(xulNode) {
    let cls = ITEM_CLASS;

    if (xulNode.parentNode.id == "contentAreaContextMenu")
      cls += " " + TOPLEVEL_ITEM_CLASS;

    if (xulNode.parentNode.id == OVERFLOW_POPUP_ID)
      cls += " " + OVERFLOW_ITEM_CLASS;

    xulNode.className = cls;
  },

  getXULNodeForItem: function getXULNodeForItem(window, item) {
    return this.windowMap.get(window).menuMap.get(item);
  },

  // Works out where to insert a XUL node for an item in a browser window
  getInsertionPoint: function getInsertionPoint(window, item, after) {
    let menupopup = null
    let before = null;

    let menu = internal(item).parentMenu;
    if (menu === rootMenu) {
      menupopup = window.document.getElementById(OVERFLOW_POPUP_ID);

      // If there isn't already an overflow menu then check if we need to
      // create one, otherwise use the main context menu
      if (!menupopup) {
        menupopup = window.document.getElementById("contentAreaContextMenu");
        let toplevel = window.document.querySelectorAll("." + TOPLEVEL_ITEM_CLASS);

        if (toplevel.length == 0) {
          // Create the separator
          let separator = window.document.createElement("menuseparator");
          separator.setAttribute("id", SEPARATOR_ID);
          menupopup.appendChild(separator);
        }
        else if (toplevel.length >= this.overflowThreshold) {
          // Create the overflow menu and move everything there
          let overflowMenu = window.document.createElement("menu");
          overflowMenu.setAttribute("id", OVERFLOW_MENU_ID);
          overflowMenu.setAttribute("label", OVERFLOW_MENU_LABEL);
          menupopup.appendChild(overflowMenu);

          menupopup = window.document.createElement("menupopup");
          menupopup.setAttribute("id", OVERFLOW_POPUP_ID);
          overflowMenu.appendChild(menupopup);

          for (let xulNode of toplevel) {
            menupopup.appendChild(xulNode);
            this.setClass(xulNode);
          }
        }
      }
    }
    else {
      let xulNode = this.getXULNodeForItem(window, menu);
      menupopup = xulNode.firstChild;
    }

    // TODO figure out the before element so all items from the same add-on
    // stick together

    return {
      menupopup: menupopup,
      before: before
    };
  },

  // Creates a XUL node for an item in a window
  createItemInWindow: function createItemInWindow(window, item, after) {
    let state = this.windowMap.get(window);

    let { menupopup, before } = this.getInsertionPoint(window, item, after);

    let type = "menuitem";
    if (item instanceof Menu)
      type = "menu";
    else if (item instanceof Separator)
      type = "menuseparator";

    let xulNode = window.document.createElement(type);
    if (item instanceof LabelledItem) {
      xulNode.setAttribute("label", item.label);
      if (item.image)
        xulNode.setAttribute("image", item.image);
      if (item.data)
        xulNode.setAttribute("value", item.data);

      xulNode.addEventListener("click", function(event) {
        // Only care about clicks directly on this item
        if (event.target !== xulNode)
          return;

        let popupNode = window.document.getElementById("contentAreaContextMenu").triggerNode;

        itemClicked(item, item, popupNode);
      }, false);
    }

    menupopup.insertBefore(xulNode, before);
    this.setClass(xulNode);
    xulNode.data = item.data;

    if (item instanceof Menu) {
      menupopup = window.document.createElement("menupopup");
      xulNode.appendChild(menupopup);
    }

    state.menuMap.set(item, xulNode);
  },

  // Creates a XUL node for an item in every window we've already populated
  createItem: function createItem(item, after) {
    for (let window of this.windows)
      this.createItemInWindow(window, item, after);
  },

  // Updates the XUL node for an item in every window we've already populated
  updateItem: function updateItem(item) {
    for (let window of this.windows) {
      let xulNode = this.getXULNodeForItem(window, item);

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
    }
  },

  // Moves the XUL node for an item in every window we've ever populated to its
  // new place in the hierarchy
  moveItem: function moveItem(item, after) {
    for (let window of this.windows) {
      let state = this.windowMap.get(window);
      let xulNode = state.menuMap.get(item);

      let oldParent = xulNode.parentNode;

      let { menupopup, before } = this.getInsertionPoint(window, item, after);
      menupopup.insertBefore(xulNode, before);

      this.setClass(xulNode);

      this.onXULRemoved(oldParent);
    }
  },

  // Removes the XUL nodes for an item in every window we've ever populated.
  removeItem: function removeItem(item) {
    for (let window of this.windows) {
      let state = this.windowMap.get(window);
      let xulItem = state.menuMap.get(item);

      let oldParent = xulItem.parentNode;

      oldParent.removeChild(xulItem);
      state.menuMap.delete(item);

      this.onXULRemoved(oldParent);
    }
  }
};

WindowTracker(MenuManager);
