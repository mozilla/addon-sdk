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
 *   Irakli Gozalishvili <gozala@mozilla.com>
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
const { EventEmitterTrait: EventEmitter } = require("events");
const observerServ = require("observer-service");
const jpSelf = require("self");

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

// This object is used elsewhere in this file to access private properties of
// Item and Menu instances.
const PRIVATE_PROPS_KEY = {
  valueOf: function valueOf() "private properties key"
};

// Used as an internal ID for items and as part of a public ID for item DOM
// elements.
let nextItemID = 0;

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

  options.items.forEach(function (i) browserManager.removeItem(i));
  browserManager.addItem(this);
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

  const self = this;

  this.isCurrent = function URLContext_isCurrent(popupNode) {
    return self.isCurrentForURL(popupNode.ownerDocument.URL);
  };

  this.isCurrentForURL = function URLContext_isCurrentForURL(url) {
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
  item.__defineGetter__("label", function () options.label);
  item.__defineSetter__("label", function setItemLabel(val) {
    let { label } = apiUtils.validateOptions({ label: val }, optionsRules());
    options.label = label;
    browserManager.setItemLabel(item, label);
  });

  // Stupid ternaries to avoid Spidermonkey strict warnings.
  item.__defineGetter__("contentScript", function () {
    return "contentScript" in options ? options.contentScript : undefined;
  });
  item.__defineGetter__("contentScriptFile", function () {
    return "contentScriptFile" in options ? options.contentScriptFile :
           undefined;
  });

  item.destroy = function Item_destroy() {
    browserManager.removeItem(item);
  };

  // Create a private properties object for the item.
  let privateProps = {
    eventEmitter: EventEmitter.create(item),
    workerReg: new WorkerRegistry(item),
    id: nextItemID++
  };

  // This makes the private properties accessible to anyone with access to the
  // PRIVATE_PROPS_KEY object.  Only this file has has access to it, so only
  // this file has access to the private properties.
  item.valueOf = function Item_valueOf(key) {
    return key === PRIVATE_PROPS_KEY ? privateProps : item;
  };

  // Add all of privateProps.eventEmitter's own public methods to the item,
  // binding them to eventEmitter.  This will allow clients to treat the item as
  // an event emitter.
  Object.keys(privateProps.eventEmitter).forEach(function (key) {
    if (key[0] !== "_")
      item[key] =
        privateProps.eventEmitter[key].bind(privateProps.eventEmitter);
  });

  // Register a message listener if one was passed to the constructor.
  if ("onMessage" in options)
    privateProps.eventEmitter.on("message", options.onMessage);

  // When a URL context is removed (by calling item.context.remove(urlContext)),
  // we may need to create workers for windows containing pages that the item
  // now matches.  Likewise, when a URL context is added, we need to destroy
  // workers for windows containing pages that the item now does not match.
  //
  // collection doesn't provide a way to listen for removals.  utils/registry
  // does, but it doesn't allow its elements to be enumerated.  So as a hack,
  // use a collection for item.context and replace its add and remove methods.
  collection.addCollectionProperty(item, "context");
  if (options.context)
    item.context.add(options.context);

  let add = item.context.add;
  item.context.add = function itemContextAdd() {
    let args = Array.slice(arguments);
    add.apply(item.context, args);
    if (args.some(function (a) a instanceof URLContext))
      privateProps.workerReg.destroyUnneededWorkers();
  };

  let remove = item.context.remove;
  item.context.remove = function itemContextRemove() {
    let args = Array.slice(arguments);
    remove.apply(item.context, args);
    if (args.some(function (a) a instanceof URLContext))
      privateProps.workerReg.createNeededWorkers();
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

// Builds an ID suitable for a DOM element from the given item ID.  The optional
// suffix will be appended to the returned ID.
function domEltIDFromItemID(itemID, suffix) {
  suffix = suffix || "";
  if (!/^[-a-z]*$/.test(suffix))
    throw new Error("Internal error: suffix must match the regexp [-a-z]*");
  return jpSelf.id + "-context-menu-item-" + itemID + suffix;
}

// Parses the item ID out of the given DOM element ID and returns it.
function itemIDFromDOMEltID(domEltID) {
  return Number(/([0-9]+)[-a-z]*$/.exec(domEltID)[1]);
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
  },

  // Sets the given item's label in all the browser windows.  See
  // ContextMenuPopup.setItemLabel.
  setItemLabel: function browserManager_setItemLabel(item, label) {
    this.windows.forEach(function (w) w.setItemLabel(item, label));
  },

  // Registers the manager to listen for window openings and closings.  Note
  // that calling this method can cause onTrack to be called immediately if
  // there are open windows.
  init: function browserManager_init() {
    require("unload").ensure(this);
    let windowTracker = new (require("window-utils").WindowTracker)(this);

    // On inner-window-destroyed, remove the destroyed inner window's outer
    // window from all items' worker registries.
    observerServ.add("inner-window-destroyed", function observe(subj) {
      let innerWinID = subj.QueryInterface(Ci.nsISupportsPRUint64).data;
      this.items.forEach(function (item) {
        let workerReg = item.valueOf(PRIVATE_PROPS_KEY).workerReg;
        workerReg.unregisterContentWin(innerWinID);
      });
    }, this);
  },

  // When the window tracker is unloaded, it'll call our onUntrack for every
  // open browser window, so there's no need to do that here.  The only other
  // things to clean up are items and their worker registries.
  unload: function browserManager_unload() {
    this.items.forEach(function (item) {
      item.valueOf(PRIVATE_PROPS_KEY).workerReg.destroy();
    });
    this.items.splice(0, this.items.length);
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
      item.valueOf(PRIVATE_PROPS_KEY).workerReg.destroy();
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
    return this._contentWorker._listeners("context").length > 0;
  },

  // Returns the first string or truthy value returned by a context listener in
  // the worker's port.  If none return a string or truthy value or if there are
  // no context listeners, returns false.  popupNode is the node that was
  // context-clicked.
  isAnyContextCurrent: function CMW_isAnyContextCurrent(popupNode) {
    let listeners = this._contentWorker._listeners("context");
    for (let i = 0; i < listeners.length; i++) {
      try {
        let val = listeners[i].call(this._contentWorker._sandbox, popupNode);
        if (typeof(val) === "string" || val)
          return val;
      }
      catch (err) {
        console.exception(err);
      }
    }
    return false;
  },

  // Emits a click event in the worker's port.  popupNode is the node that was
  // context-clicked, and clickedItemData is the data of the item that was
  // clicked.
  fireClick: function CMW_fireClick(popupNode, clickedItemData) {
    this._contentWorker._asyncEmit("click", popupNode, clickedItemData);
  }
});


// This class creates and stores content workers for pairs of menu items and
// content windows.  Use one instance for each item.  Not all pairs need a
// worker: if an item has a URL context that does not match a window's page,
// then no worker is created for the pair.
function WorkerRegistry(item) {
  this.item = item;

  // inner window ID => { win, worker }
  this.winWorkers = {};

  // inner window ID => content window
  this.winsWithoutWorkers = {};
}

WorkerRegistry.prototype = {

  // Registers a content window, creating a worker for it if it needs one.
  registerContentWin: function WR_registerContentWin(win) {
    let innerWinID = this._innerWinID(win);
    if (this._doesURLNeedWorker(win.document.URL))
      this.winWorkers[innerWinID] = { win: win, worker: this._makeWorker(win) };
    else
      this.winsWithoutWorkers[innerWinID] = win;
  },

  // Unregisters a content window, destroying its related worker if it has one.
  unregisterContentWin: function WR_unregisterContentWin(innerWinID) {
    // Sometimes inner-window-destroyed is sent for a window that's not
    // registered, which implies that DOMContentLoaded is not dispatched to any
    // tabbrowser for that inner window's outer window...  So rather than
    // erroneously throwing an error if the window is not registered, don't
    // assume that the window is registered in the first place.
    if (innerWinID in this.winWorkers) {
      let winWorker = this.winWorkers[innerWinID];
      winWorker.worker.destroy();
      delete winWorker.worker;
      delete winWorker.win;
      delete this.winWorkers[innerWinID];
    }
    else
      delete this.winsWithoutWorkers[innerWinID];
  },

  // Creates a worker for each window that needs a worker but doesn't have one.
  createNeededWorkers: function WR_createNeededWorkers() {
    for (let [innerWinID, win] in Iterator(this.winsWithoutWorkers)) {
      delete this.winsWithoutWorkers[innerWinID];
      this.registerContentWin(win);
    }
  },

  // Destroys the worker for each window that has a worker but doesn't need it.
  destroyUnneededWorkers: function WR_destroyUnneededWorkers() {
    for (let [innerWinID, winWorker] in Iterator(this.winWorkers)) {
      if (!this._doesURLNeedWorker(winWorker.win.document.URL)) {
        this.unregisterContentWin(innerWinID);
        this.winsWithoutWorkers[innerWinID] = winWorker.win;
      }
    }
  },

  // Returns the worker for the item-window pair or null if none exists.
  find: function WR_find(contentWin) {
    let innerWinID = this._innerWinID(contentWin);
    return (innerWinID in this.winWorkers) ?
           this.winWorkers[innerWinID].worker :
           null;
  },

  // Unregisters all content windows in the registry, destroying all workers.
  destroy: function WR_destroy() {
    for (let innerWinID in this.winWorkers)
      this.unregisterContentWin(innerWinID);
    for (let innerWinID in this.winsWithoutWorkers)
      this.unregisterContentWin(innerWinID);
  },

  // Returns false if the item has a URL context that does not match the given
  // URL.
  _doesURLNeedWorker: function WR__doesURLNeedWorker(url) {
    for (let ctxt in this.item.context)
      if ((ctxt instanceof URLContext) && !ctxt.isCurrentForURL(url))
        return false;
    return true;
  },

  _makeWorker: function WR__makeWorker(win) {
    let worker = ContextMenuWorker({
      window: win.wrappedJSObject,
      contentScript: this.item.contentScript,
      contentScriptFile: this.item.contentScriptFile,
      onError: function (err) console.exception(err)
    });
    let (item = this.item) worker.on("message", function workerOnMessage(msg) {
      try {
        let eventEmitter = item.valueOf(PRIVATE_PROPS_KEY).eventEmitter;
        eventEmitter._emitOnObject(item, "message", msg);
      }
      catch (err) {
        console.exception(err);
      }
    });
    return worker;
  },

  _innerWinID: function WR__innerWinID(win) {
    return win.
           QueryInterface(Ci.nsIInterfaceRequestor).
           getInterface(Ci.nsIDOMWindowUtils).
           currentInnerWindowID;
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
}

BrowserWindow.prototype = {

  // Adds an array of items to the window's context menu.
  addItems: function BW_addItems(items) {
    this.contextMenuPopup.addItems(items);

    // Register all open and loaded content windows in this browser window with
    // each item's worker registry.
    items.forEach(function (item) {
      this.window.gBrowser.browsers.forEach(function (browser) {
        if (browser.contentDocument.readyState === "complete") {
          item.valueOf(PRIVATE_PROPS_KEY).workerReg.
            registerContentWin(browser.contentWindow);
        }
      }, this);
    }, this);
  },

  // Sets the given item's label in the browser window's context menu.  See
  // ContextMenuPopup.setItemLabel.
  setItemLabel: function BW_setItemLabel(item, label) {
    this.contextMenuPopup.setItemLabel(item, label);
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
    let worker = item.valueOf(PRIVATE_PROPS_KEY).workerReg.find(win);

    // If the worker for the item-window pair doesn't exist (e.g., because the
    // page hasn't loaded yet), we can't really make a good decision since the
    // content script may have a context listener.  So just don't show the item
    // at all.
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
    let worker = item.valueOf(PRIVATE_PROPS_KEY).workerReg.find(win);
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
    browserManager.items.forEach(function (item) {
      item.valueOf(PRIVATE_PROPS_KEY).workerReg.registerContentWin(win);
    });
  }
};


// Represents a container of items that's the child of the given Menu and Popup.
// popupElt is a xul:menupopup that represents the popup in the DOM, and window
// is the BrowserWindow containing the popup.  The popup is responsible for
// creating and adding items to poupElt and handling command events.
function Popup(parentMenu, parentPopup, popupElt, window) {
  this.parentMenu = parentMenu;
  this.parentPopup = parentPopup;
  this.popupElt = popupElt;
  this.window = window;
  this.doc = popupElt.ownerDocument;

  // item ID => { item, domElt }
  this.items = {};

  popupElt.addEventListener("command", this, false);
}

Popup.prototype = {

  // Adds an array of items to the popup.
  addItems: function Popup_addItems(items) {
    items.forEach(function (item) {
      let domElt = this._makeItemElt(item);
      this.items[item.valueOf(PRIVATE_PROPS_KEY).id] = {
        item: item,
        domElt: domElt
      };
      this.popupElt.appendChild(domElt);
    }, this);
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
        let itemID = itemIDFromDOMEltID(elt.id);
        if (itemID in this.items) {
          let clickedItem = this.items[itemID].item;
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

  // Returns a DOM element representing the item.  All elements will have the
  // ITEM_CLASS class, and className can optionally be used to add another.  The
  // element will have a unique ID.  idSuffix, if given, will be appended to the
  // ID.
  _makeItemElt: function Popup__makeItemElt(item, className, idSuffix) {
    let elt = item instanceof Item ? this._makeMenuitem(item, className) :
              item instanceof Menu ? this._makeMenu(item, className) :
              item instanceof Separator ? this._makeSeparator(className) :
              null;
    if (!elt)
      throw new Error("Internal error: can't make element, unknown item type");

    elt.id = domEltIDFromItemID(item.valueOf(PRIVATE_PROPS_KEY).id, idSuffix);
    return elt;
  },

  // Returns a new xul:menu representing the menu.
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

  // Returns a new xul:menuitem representing the item.
  _makeMenuitem: function Popup__makeMenuitem(item, className) {
    let elt = this.doc.createElement("menuitem");
    elt.className = ITEM_CLASS + (className ? " " + className : "");
    elt.setAttribute("label", item.label);
    if (item.data)
      elt.setAttribute("value", item.data);
    return elt;
  },

  // Returns a new xul:menuseparator.
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
    if (!items.length)
      return;

    ensureStaticEltsExist();
    ensureListeningForPopups();

    // Add each item to the top-level menu and the overflow submenu.
    items.forEach(function (item) {
      let itemID = item.valueOf(PRIVATE_PROPS_KEY).id;
      let domElt = self._makeItemElt(item, TOPLEVEL_ITEM_CLASS);
      let overflowDOMElt = self._makeItemElt(item, OVERFLOW_ITEM_CLASS,
                                             "-overflow");
      self.items[itemID] = {
        item: item,
        domElt: domElt,
        overflowDOMElt: overflowDOMElt
      };
      insertItemInSortedOrder(item);
    }, self);
  };

  // Sets the given item's label if the item has a DOM element.  The item is
  // re-inserted into the popup so that it remains in sorted order.  If the item
  // has no DOM element yet, does nothing.
  this.setItemLabel = function CMP_setItemLabel(item, label) {
    let itemID = item.valueOf(PRIVATE_PROPS_KEY).id;
    if (!(itemID in self.items))
      return;

    let { domElt, overflowDOMElt } = self.items[itemID];
    domElt.parentNode.removeChild(domElt);
    overflowDOMElt.parentNode.removeChild(overflowDOMElt);
    domElt.setAttribute("label", label);
    overflowDOMElt.setAttribute("label", label);
    insertItemInSortedOrder(item);
  };

  // Undoes all modifications to the popup.  The popup should not be used
  // afterward.
  this.destroy = function CMP_destroy() {
    for each (let { item } in self.items)
      self.removeItems([item]);

    // If there are no more items from any instance of the module, remove the
    // separator and overflow submenu, if they exist.
    let elts = topLevelElts();
    if (!elts.length) {
      let submenu = overflowMenu();
      if (submenu)
        self.popupElt.removeChild(submenu);

      let sep = separator();
      if (sep)
        self.popupElt.removeChild(sep);
    }

    // Remove event listeners.
    if (self._listeningForPopups) {
      self.popupElt.removeEventListener("popupshowing", self, false);
      delete self._listeningForPopups;
    }
    self.__proto__.destroy.call(self);
  };

  // The context menu popup needs to handle popupshowing in addition to command
  // events.  popupshowing is used to show top-level items that match the
  // window's current context and hide items that don't.  Each module instance
  // is responsible for showing and hiding the items it owns.
  this.handleEvent = function CMP_handleEvent(event) {
    if (event.type === "command")
      self.__proto__.handleEvent.call(self, event);
    else if (event.type === "popupshowing" && event.target === popupElt) {
      try {
        // popupElt.triggerNode was added in Gecko 2.0 by bug 383930.  The || is
        // to avoid a Spidermonkey strict warning on earlier versions.
        let triggerNode = popupElt.triggerNode || undefined;
        let popupNode = window.capturePopupNode(triggerNode);

        // Show and hide items.  Set a "jetpackContextCurrent" property on the
        // DOM elements to signal which of our items match the current context.
        for each (let { item, domElt, overflowDOMElt } in self.items) {
          let areContextsCurr = window.areAllContextsCurrent(item, popupNode);

          // Change the item's label if the return value was a string.
          if (typeof(areContextsCurr) === "string") {
            item.label = areContextsCurr;
            areContextsCurr = true;
          }

          domElt.jetpackContextCurrent = areContextsCurr;
          domElt.hidden = !areContextsCurr;
          overflowDOMElt.jetpackContextCurrent = areContextsCurr;
          overflowDOMElt.hidden = !areContextsCurr;
        }

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
    items.forEach(function (item) {
      let itemID = item.valueOf(PRIVATE_PROPS_KEY).id;
      let { domElt, overflowDOMElt } = self.items[itemID];
      domElt.parentNode.removeChild(domElt);
      overflowDOMElt.parentNode.removeChild(overflowDOMElt);
      delete self.items[itemID];
    }, self);
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

  // Inserts the given item's DOM element into the popup in sorted order.
  function insertItemInSortedOrder(item) {
    let itemID = item.valueOf(PRIVATE_PROPS_KEY).id;
    self.popupElt.insertBefore(self.items[itemID].domElt,
                               insertionPoint(item.label, topLevelElts()));
    overflowPopup().insertBefore(self.items[itemID].overflowDOMElt,
                                 insertionPoint(item.label, overflowElts()));
  }

  // Creates and returns the xul:menu that's shown when too many items are added
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

  // Creates and returns the xul:menuseparator that separates the standard
  // context menu items from our items.
  function makeSeparator() {
    let elt = self.doc.createElement("menuseparator");
    elt.id = SEPARATOR_ID;
    return elt;
  }

  // Returns the item elements contained in the overflow menu, a NodeList.
  function overflowElts() {
    return overflowPopup().getElementsByClassName(OVERFLOW_ITEM_CLASS);
  }

  // Returns the overflow xul:menu.
  function overflowMenu() {
    return self.doc.getElementById(OVERFLOW_MENU_ID);
  }

  // Returns the overflow xul:menupopup.
  function overflowPopup() {
    return self.doc.getElementById(OVERFLOW_POPUP_ID);
  }

  // Returns the OVERFLOW_THRESH_PREF pref value if it exists or
  // OVERFLOW_THRESH_DEFAULT if it doesn't.
  function overflowThreshold() {
    let prefs = require("preferences-service");
    return prefs.get(OVERFLOW_THRESH_PREF, OVERFLOW_THRESH_DEFAULT);
  }

  // Returns the xul:menuseparator.
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
