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

const {Ci} = require("chrome");

if (!require("xul-app").is("Firefox")) {
  throw new Error([
    "The context-menu module currently supports only Firefox.  In the future ",
    "we would like it to support other applications, however.  Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=560716 for more information."
  ].join(""));
}

const apiUtils = require("api-utils");
const collection = require("collection");
const { Worker } = require("content");
const url = require("url");
const { MatchPattern } = require("match-pattern");
const observerServ = require("observer-service");

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

// The label of the overflow sub-<menu>.
//
// TODO: Localize this.
const OVERFLOW_MENU_LABEL = "Add-ons";

// The ID of the overflow sub-<menu>.
const OVERFLOW_MENU_ID = "jetpack-content-menu-overflow-menu";

// The ID of the overflow submenu's <menupopup>.
const OVERFLOW_POPUP_ID = "jetpack-content-menu-overflow-popup";

// These are used by PageContext.isCurrent below.  If the popupNode or any of
// its ancestors is one of these, Firefox uses a tailored context menu, and so
// the page context doesn't apply.
const NON_PAGE_CONTEXT_ELTS = [
  Ci.nsIDOMHTMLAnchorElement,
  Ci.nsIDOMHTMLAppletElement,
  Ci.nsIDOMHTMLAreaElement,
  Ci.nsIDOMHTMLButtonElement,
  Ci.nsIDOMHTMLCanvasElement,
  Ci.nsIDOMHTMLEmbedElement,
  Ci.nsIDOMHTMLImageElement,
  Ci.nsIDOMHTMLInputElement,
  Ci.nsIDOMHTMLIsIndexElement,
  Ci.nsIDOMHTMLMapElement,
  Ci.nsIDOMHTMLMediaElement,
  Ci.nsIDOMHTMLMenuElement,
  Ci.nsIDOMHTMLObjectElement,
  Ci.nsIDOMHTMLOptionElement,
  Ci.nsIDOMHTMLSelectElement,
  Ci.nsIDOMHTMLTextAreaElement,
];


exports.Item = apiUtils.publicConstructor(Item);
exports.Menu = apiUtils.publicConstructor(Menu);
exports.Separator = apiUtils.publicConstructor(Separator);


function Item(options) {
  let rules = optionsRules();
  rules.data = {
    map: function (v) v.toString(),
    is: ["string", "undefined"]
  };
  options = apiUtils.validateOptions(options, rules);

  defineItemProps(this, options);

  // TODO: Add setter for this?
  this.__defineGetter__("data", function () {
    return "data" in options ? options.data : undefined;
  });

  this.toString = function Item_toString() {
    return '[object Item "' + options.label + '"]';
  };

  browserManager.addItem(this);
}

function Menu(options) {
  let rules = optionsRules();
  rules.items = {
    is: ["array"]
  };
  options = apiUtils.validateOptions(options, rules);

  defineItemProps(this, options);

  // TODO: Add setter for this?
  this.__defineGetter__("items", function () options.items.slice(0));

  this.toString = function Menu_toString() {
    return '[object Menu "' + options.label + '"]';
  };

  browserManager.addItem(this);
  options.items.forEach(function (i) browserManager.removeItem(i));
}

function Separator() {
  this.toString = function Separator_toString() {
    return "[object Separator]";
  };
}


function Context() {}

function PageContext() {
  this.isCurrent = function PageContext_isCurrent(popupNode) {
    let win = popupNode.ownerDocument.defaultView;
    if (win && !win.getSelection().isCollapsed)
      return false;

    let cursor = popupNode;
    while (cursor && !(cursor instanceof Ci.nsIDOMHTMLHtmlElement)) {
      if (NON_PAGE_CONTEXT_ELTS.some(function (iface) cursor instanceof iface))
        return false;
      cursor = cursor.parentNode;
    }
    return true;
  };
}

PageContext.prototype = new Context();

function SelectorContext(selector) {
  let opts = apiUtils.validateOptions({ selector: selector }, {
    selector: {
      is: ["string"],
      msg: "selector must be a string."
    }
  });

  this.adjustPopupNode = function SelectorContext_adjustPopupNode(node) {
    return closestMatchingAncestor(node);
  };

  this.isCurrent = function SelectorContext_isCurrent(popupNode) {
    return !!closestMatchingAncestor(popupNode);
  };

  // Returns node if it matches selector, or the closest ancestor of node that
  // matches, or null if node and none of its ancestors matches.
  function closestMatchingAncestor(node) {
    let cursor = node;
    while (cursor) {
      if (cursor.mozMatchesSelector(selector))
        return cursor;
      if (cursor instanceof Ci.nsIDOMHTMLHtmlElement)
        break;
      cursor = cursor.parentNode;
    }
    return null;
  }
}

SelectorContext.prototype = new Context();

function SelectionContext() {
  this.isCurrent = function SelectionContext_isCurrent(popupNode) {
    let win = popupNode.ownerDocument.defaultView;
    if (!win)
      return false;
    return !win.getSelection().isCollapsed;
  };
}

SelectionContext.prototype = new Context();

function URLContext(patterns) {
  let opts = apiUtils.validateOptions({ patterns: patterns }, {
    patterns: {
      map: function (v) apiUtils.getTypeOf(v) === "array" ? v : [v],
      ok: function (v) v.every(function (p) typeof(p) === "string"),
      msg: "patterns must be a string or an array of strings."
    }
  });
  try {
    patterns = opts.patterns.map(function (p) new MatchPattern(p));
  }
  catch (err) {
    console.error("Error creating URLContext match pattern:");
    throw err;
  }

  this.isCurrent = function URLContext_isCurrent(popupNode) {
    let url = popupNode.ownerDocument.URL;
    return patterns.some(function (p) p.test(url));
  };
}

URLContext.prototype = new Context();

exports.PageContext = apiUtils.publicConstructor(PageContext);
exports.SelectorContext = apiUtils.publicConstructor(SelectorContext);
exports.SelectionContext = apiUtils.publicConstructor(SelectionContext);
exports.URLContext = apiUtils.publicConstructor(URLContext);


// Returns rules for apiUtils.validateOptions() common to Item and Menu.
function optionsRules() {
  return {
    context: {
      is: ["undefined", "object", "array"],
      ok: function (v) {
        if (!v)
          return true;
        let arr = apiUtils.getTypeOf(v) === "array" ? v : [v];
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
    contentScript: {
      is: ["string", "array", "undefined"],
      ok: function (v) {
        return apiUtils.getTypeOf(v) !== "array" ||
               v.every(function (s) typeof(s) === "string");
      }
    },
    contentScriptFile: {
      is: ["string", "array", "undefined"],
      ok: function (v) {
        if (!v)
          return true;
        let arr = apiUtils.getTypeOf(v) === "array" ? v : [v];
        try {
          return arr.every(function (s) {
            return apiUtils.getTypeOf(s) === "string" && url.toFilename(s);
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
}

// Defines some getters and other properties that are common to Item and Menu.
// item is the Item or Menu object on which to define the properties, and
// options is a validated options object.
function defineItemProps(item, options) {
  // TODO: Add setter for label?  It would require finding the item's DOM
  // element and changing its attributes as well.  Note however that
  // WorkerRegistry relies on label remaining constant, so if setters are added,
  // that would need fixing.
  item.__defineGetter__("label", function () options.label);

  // Stupid ternaries to avoid Spidermonkey strict warnings.
  item.__defineGetter__("contentScript", function () {
    return "contentScript" in options ? options.contentScript : undefined;
  });
  item.__defineGetter__("contentScriptFile", function () {
    return "contentScriptFile" in options ? options.contentScriptFile :
           undefined;
  });
  item.__defineGetter__("onMessage", function () {
    return "onMessage" in options ? options.onMessage : undefined;
  });

  collection.addCollectionProperty(item, "context");
  if (options.context)
    item.context.add(options.context);

  item.destroy = function Item_destroy() {
    browserManager.removeItem(item);
  };
}

// Does a binary search on elts, a NodeList, and returns the DOM element
// before which an item with targetLabel should be inserted.  null is returned
// if the new item should be inserted at the end.
function insertionPoint(targetLabel, elts) {
  let from = 0;
  let to = elts.length - 1;

  while (from <= to) {
    let i = Math.floor((from + to) / 2);
    let comp = targetLabel.localeCompare(elts[i].getAttribute("label"));
    if (comp < 0)
      to = i - 1;
    else if (comp > 0)
      from = i + 1;
    else
      return elts[i];
  }
  return elts[from] || null;
}


// Keeps track of all browser windows.
let browserManager = {
  items: [],
  windows: [],

  // Registers an item with the manager.  It's added to the context menus of
  // all currently registered windows, and when new windows are registered it
  // will be added to them, too.
  addItem: function browserManager_addItem(item) {
    this.items.push(item);
    this.windows.forEach(function (w) w.addItems([item]));
    this.workerReg.registerItems([item]);
  },

  // Registers the manager to listen for window openings and closings.  Note
  // that calling this method can cause onTrack to be called immediately if
  // there are open windows.
  init: function browserManager_init() {
    require("unload").ensure(this);
    this.workerReg = new WorkerRegistry();
    let windowTracker = new (require("window-utils").WindowTracker)(this);

    // On inner-window-destroyed, remove the destroyed inner window's outer
    // window from the worker registry.
    observerServ.add("inner-window-destroyed", function observe(subj) {
      let innerWinID = subj.QueryInterface(Ci.nsISupportsPRUint64).data;
      this.workerReg.unregisterContentWin(innerWinID);
    }, this);
  },

  // When the window tracker is unloaded, it'll call our onUntrack for every
  // open browser window, so there's no need to do that here.  The only other
  // things to clean up are items and the worker registry.
  unload: function browserManager_unload() {
    this.items.splice(0, this.items.length);
    this.workerReg.destroy();
  },

  // Registers a window with the manager.  This is a WindowTracker callback.
  onTrack: function browserManager_onTrack(window) {
    if (this._isBrowserWindow(window)) {
      let win = new BrowserWindow(window);
      this.windows.push(win);
      win.addItems(this.items);
    }
  },

  // Unregisters a window from the manager.  It's told to undo all menu
  // modifications.  This is a WindowTracker callback.
  onUntrack: function browserManager_onUntrack(window) {
    if (this._isBrowserWindow(window)) {
      for (let i = 0; i < this.windows.length; i++) {
        if (this.windows[i].window == window) {
          let win = this.windows.splice(i, 1)[0];
          win.destroy();
          return;
        }
      }
    }
  },

  // Unregisters an item from the manager.  It's removed from the context menus
  // of all windows that are currently registered.  If the item is not
  // registered, this is a no-op.
  removeItem: function browserManager_removeItem(item) {
    let idx = this.items.indexOf(item);
    if (idx >= 0) {
      this.items.splice(idx, 1);
      this.windows.forEach(function (w) w.removeItems([item]));
      this.workerReg.unregisterItems([item]);
    }
  },

  _isBrowserWindow: function browserManager__isBrowserWindow(win) {
    let winType = win.document.documentElement.getAttribute("windowtype");
    return winType === "navigator:browser";
  }
};


// A type of Worker tailored to our uses.
const ContextMenuWorker = Worker.compose({
  destroy: Worker.required,

  // Returns true if any context listeners are defined in the worker's port.
  anyContextListeners: function CMW_anyContextListeners() {
    return this._port._listeners("context").length > 0;
  },

  // Returns true if any of the context listeners in the worker's port return
  // true.  popupNode is the node that was context-clicked.
  isAnyContextCurrent: function CMW_isAnyContextCurrent(popupNode) {
    let listeners = this._port._listeners("context");
    for (let i = 0; i < listeners.length; i++)
      if (listeners[i].call(this._port._sandbox, popupNode))
        return true;
    return false;
  },

  // Emits a click event in the worker's port.  popupNode is the node that was
  // context-clicked, and clickedItemData is the data of the item that was
  // clicked.
  fireClick: function CMW_fireClick(popupNode, clickedItemData) {
    this._port._emit("click", popupNode, clickedItemData);
  }
});


// This class creates and stores content workers for pairs of menu items and
// content windows.  Since workers need to be looked up every time the context
// menu is shown, the main purpose of this class, in addition to creating and
// storing workers, is to provide fast lookup of workers given a menu item and
// content window.
function WorkerRegistry() {
  // This is a matrix.  The first index addresses content window keys, the
  // second menu item keys.  Each entry in the matrix stores workers for pairs
  // of content windows and menu items.
  //
  // More specifically, workers[w][i] is an array of objects { item, worker }.
  // w is a content window key.  i is a menu item key.  item is a menu item
  // whose key is i.  worker is the content worker created from the window-item
  // pair.
  //
  // Keys are just a way to provide O(1) lookup of a window or item.  Actually,
  // unlike window keys, menu item keys are not required to be unique, which has
  // two consequences: 1) menu item lookup using a key may be more than O(1) in
  // time, and 2) workers[w][i] is an array and not a single object.  Keys are
  // not expected to change over the lifetime of a window or menu item.
  //
  // This structure is fairly simple and allows worker lookups in constant time
  // in the best case.  In the worst case, however -- when all menu items have
  // the same key -- lookup is O(I), where I is the number of items in the
  // registry.  I don't expect any given developer to create many items with the
  // same key, so I think it's a good trade-off.
  //
  // If there are registered windows but no registered items or vice versa, this
  // will be empty.
  this.workers = {};

  // A map of items, item key => item list.  Item keys are not unique, so each
  // maps to a list of items with the same key.
  this.items = {};

  // A map of content windows, window key => window.
  this.wins = {};
}

WorkerRegistry.prototype = {

  // Registers a content window, creating workers for each pair formed by the
  // window and all previously registered menu items.
  registerContentWin: function WR_registerContentWin(win) {
    let winKey = this._winKey(win);
    for (let [itemKey, itemList] in Iterator(this.items)) {
      itemList.forEach(function (item) {
        this._registerPair(win, winKey, item, itemKey);
      }, this);
    }
    this.wins[winKey] = win;
  },

  // Registers an array of menu items, creating workers for each pair formed by
  // the items and all previously registered content windows.
  registerItems: function WR_registerItems(items) {
    items.forEach(function (item) {
      let itemKey = this._itemKey(item);
      for (let [winKey, win] in Iterator(this.wins))
        this._registerPair(win, winKey, item, itemKey);
      this.items[itemKey] = this.items[itemKey] || [];
      this.items[itemKey].push(item);
    }, this);
  },

  // Unregisters a content window, destroying all related workers.
  unregisterContentWin: function WR_unregisterContentWin(innerWinID) {
    let winKey = innerWinID;

    // Sometimes inner-window-destroyed is sent for a window that's not
    // registered, which implies that DOMContentLoaded is not dispatched to any
    // tabbrowser for that inner window's outer window...  So rather than
    // erroneously throwing an error if the window is not registered, don't
    // assume that the window is registered in the first place.

    // Remove the window's entry in the worker matrix.
    if (winKey in this.workers) {
      let itemKeyToEntriesMap = this.workers[winKey];
      for each (let entries in itemKeyToEntriesMap)
        entries.forEach(function (entry) this._destroyEntry(entry), this);
      delete this.workers[winKey];
    }

    // Remove the window from the window map.
    delete this.wins[winKey];
  },

  // Unregisters an array of menu items, destroying all related workers.
  unregisterItems: function WR_unregisterItems(items) {
    // Remove each item in each window-row in the worker matrix.
    items.forEach(function (item) {
      let itemKey = this._itemKey(item);
      for (let [winKey, win] in Iterator(this.wins)) {
        let numEntriesForKeyPair = this._unregisterPair(winKey, item, itemKey);

        // If there are no more worker entries for this window key and item key
        // pair, remove the item-column.
        if (!numEntriesForKeyPair)
          delete this.workers[winKey][itemKey];
      }

      // Remove the item from its list in the map of items.
      if (!(itemKey in this.items))
        throw new Error("Internal error: item key not in item map.");
      let itemList = this.items[itemKey];
      let idx = itemList.indexOf(item);
      if (idx < 0)
        throw new Error("Internal error: item not in item list.");
      itemList.splice(idx, 1);

      // Remove the item key from the map if its chain is empty.
      if (!itemList.length)
        delete this.items[itemKey];
    }, this);
  },

  // Returns the worker for the given window-item pair, or null if none exists.
  find: function WR_find(contentWin, item) {
    let winKey = this._winKey(contentWin);
    if (winKey in this.workers) {
      let itemKey = this._itemKey(item);
      if (itemKey in this.workers[winKey]) {
        let entries = this.workers[winKey][itemKey];
        let idx = this._indexOfEntry(entries, item);
        if (idx >= 0)
          return entries[idx].worker;
      }
    }
    return null;
  },

  // Unregisters all content windows and items, destroying all workers.
  destroy: function WR_destroy() {
    for (let winKey in this.wins)
      this.unregisterContentWin(winKey);

    // Calling unregisterContentWin for all windows clears the window map and
    // the worker matrix.  The only thing left to do is clear the item map.
    for (let [itemKey, itemList] in Iterator(this.items)) {
      itemList.splice(0, itemList.length);
      delete this.items[itemKey];
    }
  },

  // Creates a worker for the given window-item pair and adds it to the worker
  // matrix.
  _registerPair: function WR__registerPair(win, winKey, item, itemKey) {
    let worker = this._makeWorker(win, item);
    this.workers[winKey] = this.workers[winKey] || {};
    this.workers[winKey][itemKey] = this.workers[winKey][itemKey] || [];
    this.workers[winKey][itemKey].push({
      win: win,
      item: item,
      worker: worker
    });
  },

  // Removes the worker entry of the given window-item pair from the worker
  // matrix.  Returns the number of remaining items paired with the window.
  _unregisterPair: function WR__unregisterPair(winKey, item, itemKey) {
    if (!(winKey in this.workers))
      throw new Error("Internal error: window key not in registry.");
    if (!(itemKey in this.workers[winKey]))
      throw new Error("Internal error: item key not in registry.");
    let entries = this.workers[winKey][itemKey];
    let idx = this._indexOfEntry(entries, item);
    if (idx < 0)
      throw new Error("Internal error: target pair not found.");
    this._destroyEntry(entries[idx]);
    entries.splice(idx, 1);
    return entries.length;
  },

  // Returns the index of the worker entry in the given list containing the
  // given item.
  _indexOfEntry: function WR__indexOfEntry(entries, item) {
    let idx = 0;
    for (; idx < entries.length; idx++)
      if (entries[idx].item === item)
        break;
    return idx >= entries.length ? -1 : idx;
  },

  _makeWorker: function WR__makeWorker(win, item) {
    let worker = ContextMenuWorker({
      window: win.wrappedJSObject,
      contentScript: item.contentScript,
      contentScriptFile: item.contentScriptFile,
      onError: function (err) console.exception(err)
    });
    worker.on("message", function workerOnMessage(msg) {
      if (item.onMessage) {
        try {
          item.onMessage(msg);
        }
        catch (err) {
          console.exception(err);
        }
      }
    });
    return worker;
  },

  _destroyEntry: function WR__destroyEntry(entry) {
    entry.worker.destroy();
    delete entry.worker;
    delete entry.item;
  },

  _winKey: function WR__winKey(win) {
    return win.
           QueryInterface(Ci.nsIInterfaceRequestor).
           getInterface(Ci.nsIDOMWindowUtils).
           currentInnerWindowID;
  },

  _itemKey: function WR__itemKey(item) {
    // We rely on label remaining constant over the lifetime of the item.
    return item.label;
  }
};


// Keeps track of a single browser window.  Responsible for providing a
// description of the window's current context and determining whether an item
// matches the current context.
//
// TODO: If other apps besides Firefox want to support the context menu in
// whatever way is appropriate for them, plugging in a substitute for this class
// should be the way to do it.  Make it easy for them.  See bug 560716.
function BrowserWindow(window) {
  this.window = window;
  this.doc = window.document;

  let popup = this.doc.getElementById("contentAreaContextMenu");
  if (!popup)
    throw new Error("Internal error: Context menu popup not found.");
  this.contextMenuPopup = new ContextMenuPopup(popup, this);

  // Listen for page loads on the tabbrowser so we can create workers.
  window.gBrowser.addEventListener("DOMContentLoaded", this, false);

  // Register content windows that are already open and loaded.
  let browsers = window.gBrowser.browsers;
  for (let i = 0; i < browsers.length; i++)
    if (browsers[i].contentDocument.readyState === "complete")
      this._registerContentWin(browsers[i].contentWindow);
}

BrowserWindow.prototype = {

  // Adds an array of items to the window's context menu.
  addItems: function BW_addItems(items) {
    this.contextMenuPopup.addItems(items);
  },

  // The context specified for a top-level item may not match exactly the real
  // context that triggers it.  For example, if the user context-clicks a span
  // inside an anchor, we want items that specify an anchor context to be
  // triggered, but the real context will indicate that the span was clicked,
  // not the anchor.  Where the real context and an item's context conflict,
  // clients should be given the item's context, and this method can be used to
  // make such adjustments.  Returns an adjusted popupNode.
  adjustPopupNode: function BW_adjustPopupNode(popupNode, topLevelItem) {
    for (let ctxt in topLevelItem.context) {
      if (typeof(ctxt.adjustPopupNode) === "function") {
        let ctxtNode = ctxt.adjustPopupNode(popupNode);
        if (ctxtNode) {
          popupNode = ctxtNode;
          break;
        }
      }
    }
    return popupNode;
  },

  // Returns true if all of item's contexts are current in the window.
  areAllContextsCurrent: function BW_areAllContextsCurrent(item, popupNode) {
    let win = popupNode.ownerDocument.defaultView;
    let worker = browserManager.workerReg.find(win, item);

    // If the worker for the content-window-item pair doesn't exist (e.g.,
    // because the page hasn't loaded yet), we can't really make a good decision
    // since the content script may have a context listener.  So just don't show
    // the item at all.
    if (!worker)
      return false;

    // If there are no contexts given at all, the page context applies.
    let hasContentContext = worker.anyContextListeners();
    if (!hasContentContext && !item.context.length)
      return new PageContext().isCurrent(popupNode);

    // Otherwise, determine if all given contexts are current.  Evaluate the
    // declarative contexts first and the worker's context listeners last.  That
    // way the listener might be able to avoid some work.
    let curr = true;
    for (let ctxt in item.context) {
      curr = curr && ctxt.isCurrent(popupNode);
      if (!curr)
        return false;
    }
    return !hasContentContext || worker.isAnyContextCurrent(popupNode);
  },

  // Sets this.popupNode to the node the user context-clicked to invoke the
  // context menu.  For Gecko 2.0 and later, triggerNode is this node; if it's
  // falsey, document.popupNode is used.  Returns the popupNode.
  capturePopupNode: function BW_capturePopupNode(triggerNode) {
    this.popupNode = triggerNode || this.doc.popupNode;
    if (!this.popupNode)
      console.warn("popupNode is null.");
    return this.popupNode;
  },

  // Undoes all modifications to the window's context menu.  The BrowserWindow
  // should not be used afterward.
  destroy: function BW_destroy() {
    this.contextMenuPopup.destroy();
    this.window.gBrowser.removeEventListener("DOMContentLoaded", this, false);
  },

  // Emits a click event in the port of the content worker related to item and
  // popupNode's content window.  Listeners will be passed popupNode and
  // clickedItemData.
  fireClick: function BW_fireClick(item, popupNode, clickedItemData) {
    let win = popupNode.ownerDocument.defaultView;
    let worker = browserManager.workerReg.find(win, item);
    if (worker)
      worker.fireClick(popupNode, clickedItemData);
  },

  // Removes an array of items from the window's context menu.
  removeItems: function BW_removeItems(items) {
    this.contextMenuPopup.removeItems(items);
  },

  // Handles content window loads.
  handleEvent: function BW_handleEvent(event) {
    try {
      switch (event.type) {
      case "DOMContentLoaded":
        if (event.target.defaultView)
          this._registerContentWin(event.target.defaultView);
        break;
      }
    }
    catch (err) {
      console.exception(err);
    }
  },

  _registerContentWin: function BW__registerContentWin(win) {
    browserManager.workerReg.registerContentWin(win);
  }
};


// Represents a container of items that's the child of the given Menu and Popup.
// popupElt is a <menupopup> that represents the popup in the DOM, and window is
// the BrowserWindow containing the popup.  The popup is responsible for
// creating and adding items to poupElt and handling command events.
function Popup(parentMenu, parentPopup, popupElt, window) {
  this.parentMenu = parentMenu;
  this.parentPopup = parentPopup;
  this.popupElt = popupElt;
  this.window = window;
  this.doc = popupElt.ownerDocument;

  // Keeps track of the DOM elements owned by this popup: { item, elt }.
  this.itemWrappers = [];

  popupElt.addEventListener("command", this, false);
}

Popup.prototype = {

  // Adds an array of items to the popup.
  addItems: function Popup_addItems(items) {
    for (let i = 0; i < items.length; i++) {
      let wrapper = { item: items[i], elt: this._makeItemElt(items[i]) };
      this.itemWrappers.push(wrapper);
      this.popupElt.appendChild(wrapper.elt);
    }
  },

  // Undoes all modifications to the popup.  The popup should not be used
  // afterward.
  destroy: function Popup_destroy() {
    this.popupElt.removeEventListener("command", this, false);
  },

  // The popup is responsible for two command events: those originating at items
  // in the popup and those bubbling to the popup's parent menu.  In the first
  // case the popup dispatches a click to the item, and in the second the popup
  // dispatches a click to its parent menu -- in that order.
  handleEvent: function Popup_handleEvent(event) {
    try {
      let elt = event.target;
      if (elt.className.split(/\s+/).indexOf(ITEM_CLASS) >= 0) {
        // If the event originated at an item in the popup, dispatch a click.
        // Also set Popup.clickedItem and popupNode so ancestor popups know
        // which item was clicked and under what context.
        let childItemWrapper = this._findItemWrapper(elt);
        if (childItemWrapper) {
          let clickedItem = childItemWrapper.item;
          let topLevelItem = this._topLevelItem(clickedItem);
          let popupNode = this.window.adjustPopupNode(this.window.popupNode,
                                                      topLevelItem);
          Popup.clickedItem = clickedItem;
          Popup.popupNode = popupNode;
          this.window.fireClick(clickedItem, popupNode, clickedItem.data);
        }

        // Dispatch a click to this popup's parent menu.
        if (this.parentMenu) {
          this.window.fireClick(this.parentMenu, Popup.popupNode,
                                Popup.clickedItem.data);
        }
      }
    }
    catch (err) {
      console.exception(err);
    }
  },

  // Returns true if the DOM element is owned by the wrapper.
  _eltMatchesItemWrapper: function Popup__eltMatchesItemWrap(elt, itemWrapper) {
    return elt == itemWrapper.elt;
  },

  // Given a DOM element, returns the item wrapper that owns it or null if none.
  _findItemWrapper: function Popup__findItemWrapper(elt) {
    for (let i = 0; i < this.itemWrappers.length; i++) {
      let wrapper = this.itemWrappers[i];
      if (this._eltMatchesItemWrapper(elt, wrapper))
        return wrapper;
    }
    return null;
  },

  // Returns a DOM element representing the item.  All elements will have the
  // ITEM_CLASS class, and className can optionally be used to add another.
  _makeItemElt: function Popup__makeItemElt(item, className) {
    let elt = item instanceof Item ? this._makeMenuitem(item, className) :
              item instanceof Menu ? this._makeMenu(item, className) :
              item instanceof Separator ? this._makeSeparator(className) :
              null;
    if (!elt)
      throw new Error("Internal error: can't make element, unknown item type");

    return elt;
  },

  // Returns a new <menu> representing the menu.
  _makeMenu: function Popup__makeMenu(menu, className) {
    let menuElt = this.doc.createElement("menu");
    menuElt.className = ITEM_CLASS + (className ? " " + className : "");
    menuElt.setAttribute("label", menu.label);
    let popupElt = this.doc.createElement("menupopup");
    menuElt.appendChild(popupElt);

    // Once items are added, this value can be thrown away.  The popup handles
    // popupshowing on its own.
    let popup = new Popup(menu, this, popupElt, this.window);
    popup.addItems(menu.items);

    return menuElt;
  },

  // Returns a new <menuitem> representing the item.
  _makeMenuitem: function Popup__makeMenuitem(item, className) {
    let elt = this.doc.createElement("menuitem");
    elt.className = ITEM_CLASS + (className ? " " + className : "");
    elt.setAttribute("label", item.label);
    if (item.data)
      elt.setAttribute("value", item.data);
    return elt;
  },

  // Returns a new <menuseparator>.
  _makeSeparator: function Popup__makeSeparator(className) {
    let elt = this.doc.createElement("menuseparator");
    elt.className = ITEM_CLASS + (className ? " " + className : "");
    return elt;
  },

  // Returns the top-level menu that contains item or item if it is top-level.
  _topLevelItem: function Popup__topLevelItem(item) {
    let popup = this;
    let topLevelItem = item;
    while (popup.parentPopup) {
      topLevelItem = popup.parentMenu;
      popup = popup.parentPopup;
    }
    return topLevelItem;
  }
};


// A subclass of Popup, this represents a window's context menu popup.  It's
// responsible for hiding and showing items according to the window's current
// context.
function ContextMenuPopup(popupElt, window) {
  const self = this;
  Popup.call(this, null, null, popupElt, window);

  // Adds an array of items to the popup.
  this.addItems = function CMP_addItems(items) {
    // Don't do anything if there are no items.
    if (items.length) {
      ensureStaticEltsExist();
      ensureListeningForPopups();

      // Add each item to the top-level menu and the overflow submenu.
      let submenuPopup = overflowPopup();
      for (let i = 0; i < items.length; i++) {
        let item = items[i];
        let wrapper = {
          item: item,
          elt: this._makeItemElt(item, TOPLEVEL_ITEM_CLASS),
          overflowElt: this._makeItemElt(item, OVERFLOW_ITEM_CLASS)
        };
        this.itemWrappers.push(wrapper);

        let targetElt = insertionPoint(item.label, topLevelElts());
        this.popupElt.insertBefore(wrapper.elt, targetElt);

        targetElt = insertionPoint(item.label, overflowElts());
        submenuPopup.insertBefore(wrapper.overflowElt, targetElt);
      }
    }
  };

  // Undoes all modifications to the popup.  The popup should not be used
  // afterward.
  this.destroy = function CMP_destroy() {
    // Remove all the items registered with this instance of the module from the
    // top-level menu and overflow submenu.
    let submenuPopup = overflowPopup();
    for (let i = 0; i < this.itemWrappers.length; i++) {
      this.popupElt.removeChild(this.itemWrappers[i].elt);
      if (submenuPopup)
        submenuPopup.removeChild(this.itemWrappers[i].overflowElt);
    }

    // If there are no more items from any instance of the module, remove the
    // separator and overflow submenu, if they exist.
    let elts = topLevelElts();
    if (!elts.length) {
      let submenu = overflowMenu();
      if (submenu)
        this.popupElt.removeChild(submenu);

      let sep = separator();
      if (sep)
        this.popupElt.removeChild(sep);
    }

    // Remove event listeners.
    if (this._listeningForPopups) {
      this.popupElt.removeEventListener("popupshowing", this, false);
      delete this._listeningForPopups;
    }
    this.__proto__.destroy.call(this);
  };

  // The context menu popup needs to handle popupshowing in addition to command
  // events.  popupshowing is used to show top-level items that match the
  // window's current context and hide items that don't.  Each module instance
  // is responsible for showing and hiding the items it owns.
  this.handleEvent = function CMP_handleEvent(event) {
    if (event.type === "command") {
      this.__proto__.handleEvent.call(this, event);
    }
    else if (event.type === "popupshowing" && event.target === popupElt) {
      try {
        // popupElt.triggerNode was added in Gecko 2.0 by bug 383930.  The || is
        // to avoid a Spidermonkey strict warning on earlier versions.
        let triggerNode = popupElt.triggerNode || undefined;
        let popupNode = window.capturePopupNode(triggerNode);

        // Show and hide items.  Set a "jetpackContextCurrent" property on the
        // DOM elements to signal which of our items match the current context.
        this.itemWrappers.forEach(function (wrapper) {
          let contextCurr = window.areAllContextsCurrent(wrapper.item,
                                                         popupNode);
          wrapper.elt.jetpackContextCurrent = contextCurr;
          wrapper.overflowElt.jetpackContextCurrent = contextCurr;
          wrapper.elt.hidden = !contextCurr;
          wrapper.overflowElt.hidden = !contextCurr;
        });

        // Get the total number of items that match the current context.  It's a
        // little tricky:  There may be other instances of this module loaded,
        // each hiding and showing their items.  So we can't base this number on
        // only our items, or on the hidden state of items.  That's why we set
        // the jetpackContextCurrent property above.  The last instance to run
        // will leave the menupopup in the correct state.
        let elts = topLevelElts();
        let numShown = Array.reduce(elts, function (total, elt) {
          return total + (elt.jetpackContextCurrent ? 1 : 0);
        }, 0);

        // If too many items are shown, show the submenu and hide the top-level
        // items.  Otherwise, hide the submenu and show the top-level items.
        let overflow = numShown > overflowThreshold();
        if (overflow)
          Array.forEach(elts, function (e) e.hidden = true);

        let submenu = overflowMenu();
        if (submenu)
          submenu.hidden = !overflow;

        // If no items are shown, hide the menu separator.
        let sep = separator();
        if (sep)
          sep.hidden = numShown === 0;
      }
      catch (err) {
        console.exception(err);
      }
    }
  };

  // Removes an array of items from the popup.
  this.removeItems = function CMP_removeItems(items) {
    let overPopup = overflowPopup();
    for (let i = 0; i < items.length; i++) {
      let idx = indexOfItemWrapper(items[i]);
      if (idx < 0) {
        // Don't throw here; continue the loop.
        let err = new Error("Internal error: item for removal not found.");
        console.exception(err);
      }

      let wrapper = this.itemWrappers[idx];
      this.popupElt.removeChild(wrapper.elt);
      overPopup.removeChild(wrapper.overflowElt);
      this.itemWrappers.splice(idx, 1);
    }
  };

  // Returns true if the DOM element is owned by the wrapper.
  this._eltMatchesItemWrapper = function CMP__eltMatchesWrap(elt, itemWrapper) {
    return elt == itemWrapper.elt || elt == itemWrapper.overflowElt;
  };

  // Adds the popupshowing listener if it hasn't been added already.
  function ensureListeningForPopups() {
    if (!self._listeningForPopups) {
      self.popupElt.addEventListener("popupshowing", self, false);
      self._listeningForPopups = true;
    }
  }

  // Adds the menu separator and overflow submenu if they don't exist.
  function ensureStaticEltsExist() {
    let sep = separator();
    if (!sep) {
      sep = makeSeparator();
      self.popupElt.appendChild(sep);
    }

    let submenu = overflowMenu();
    if (!submenu) {
      submenu = makeOverflowMenu();
      self.popupElt.insertBefore(submenu, sep.nextSibling);
    }
  }

  // Returns the index of the item wrapper containing item, -1 if none.
  function indexOfItemWrapper(item) {
    for (let i = 0; i < self.itemWrappers.length; i++) {
      if (self.itemWrappers[i].item === item)
        return i;
    }
    return -1;
  }

  // Creates and returns the <menu> that's shown when too many items are added
  // to the popup.
  function makeOverflowMenu() {
    let submenu = self.doc.createElement("menu");
    submenu.id = OVERFLOW_MENU_ID;
    submenu.setAttribute("label", OVERFLOW_MENU_LABEL);
    let popup = self.doc.createElement("menupopup");
    popup.id = OVERFLOW_POPUP_ID;
    submenu.appendChild(popup);
    return submenu;
  }

  // Creates and returns the <menuseparator> that separates the standard context
  // menu items from our items.
  function makeSeparator() {
    let elt = self.doc.createElement("menuseparator");
    elt.id = SEPARATOR_ID;
    return elt;
  }

  // Returns the item elements contained in the overflow menu, a NodeList.
  function overflowElts() {
    return overflowPopup().getElementsByClassName(OVERFLOW_ITEM_CLASS);
  }

  // Returns the overflow <menu>.
  function overflowMenu() {
    return self.doc.getElementById(OVERFLOW_MENU_ID);
  }

  // Returns the overflow <menupopup>.
  function overflowPopup() {
    return self.doc.getElementById(OVERFLOW_POPUP_ID);
  }

  // Returns the OVERFLOW_THRESH_PREF pref value if it exists or
  // OVERFLOW_THRESH_DEFAULT if it doesn't.
  function overflowThreshold() {
    let prefs = require("preferences-service");
    return prefs.get(OVERFLOW_THRESH_PREF, OVERFLOW_THRESH_DEFAULT);
  }

  // Returns the <menuseparator>.
  function separator() {
    return self.doc.getElementById(SEPARATOR_ID);
  }

  // Returns the item elements contained in the top-level menu, a NodeList.
  function topLevelElts() {
    return self.popupElt.getElementsByClassName(TOPLEVEL_ITEM_CLASS);
  }
};

ContextMenuPopup.prototype = Popup.prototype;


// Init the browserManager only after setting prototypes and such above, because
// it will cause browserManager.onTrack to be called immediately if there are
// open windows.
browserManager.init();
