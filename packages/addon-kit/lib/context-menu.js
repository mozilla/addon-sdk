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
 *   Matteo Ferretti <zer0@mozilla.com>
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

"use strict";

const {Ci} = require("chrome");

if (!require("api-utils/xul-app").is("Firefox")) {
  throw new Error([
    "The context-menu module currently supports only Firefox.  In the future ",
    "we would like it to support other applications, however.  Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=560716 for more information."
  ].join(""));
}

const apiUtils = require("api-utils/api-utils");
const collection = require("api-utils/collection");
const { Worker } = require("api-utils/content");
const url = require("api-utils/url");
const { MatchPattern } = require("api-utils/match-pattern");
const { EventEmitterTrait: EventEmitter } = require("api-utils/events");
const observerServ = require("api-utils/observer-service");
const jpSelf = require("self");
const winUtils = require("api-utils/window-utils");
const { Trait } = require("api-utils/light-traits");
const { Cortex } = require("api-utils/cortex");
const timer = require("timer");

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
  Ci.nsIDOMHTMLMapElement,
  Ci.nsIDOMHTMLMediaElement,
  Ci.nsIDOMHTMLMenuElement,
  Ci.nsIDOMHTMLObjectElement,
  Ci.nsIDOMHTMLOptionElement,
  Ci.nsIDOMHTMLSelectElement,
  Ci.nsIDOMHTMLTextAreaElement,
];

// This is used to access private properties of Item and Menu instances.
const PRIVATE_PROPS_KEY = {
  valueOf: function valueOf() "private properties key"
};

// Used as an internal ID for items and as part of a public ID for item DOM
// elements.  Careful: This number is not necessarily unique to any one instance
// of the module.  For each module instance, when the first item is created this
// number will be 0, when the second is created it will be 1, and so on.
let nextItemID = 0;

// The number of items that haven't finished initializing yet.  See
// AIT__finishActiveItemInit().
let numItemsWithUnfinishedInit = 0;

exports.Item = Item;
exports.Menu = Menu;
exports.Separator = Separator;


// A word about traits and privates.  `this` inside of traits methods is an
// object private to the implementation.  It should never be publicly leaked.
// We use Cortex in the exported menu item constructors to create public
// reflections of the private objects that hide private properties -- those
// prefixed with an underscore.  Public reflections are attached to the private
// objects via the `_public` property.
//
// All item objects passed into the implementation by the client will be public
// reflections, not private objects.  Likewise, all item objects passed out of
// the implementation to the client must be public, not private.  Mixing up
// public and private is bad and easy to do, so not only are private objects
// restricted to the implementation, but as much as possible we try to restrict
// them to the Item, Menu, and Separator traits and constructors.  Everybody
// else in the implementation should expect to be passed public reflections, and
// they must specifically request private objects via privateItem().

// Item, Menu, and Separator are composed of this trait.
const ItemBaseTrait = Trait({

  _initBase: function IBT__initBase(opts, optRules, optsToNotSet) {
    this._optRules = optRules;
    for (let optName in optRules)
      if (optsToNotSet.indexOf(optName) < 0)
        this[optName] = opts[optName];
    optsToNotSet.forEach(function (opt) validateOpt(opts[opt], optRules[opt]));
    this._isInited = true;

    this._id = nextItemID++;
    this._parentMenu = null;

    // This makes the private properties accessible to anyone with access to
    // PRIVATE_PROPS_KEY.  Barring loader tricks, only this file has has access
    // to it, so only this file has access to the private properties.
    const self = this;
    this.valueOf = function IBT_valueOf(key) {
      return key === PRIVATE_PROPS_KEY ? self : self._public;
    };
  },

  destroy: function IBT_destroy() {
    if (this._wasDestroyed)
      return;
    if (this.parentMenu)
      this.parentMenu.removeItem(this._public);
    else if (!(this instanceof Separator) && this._hasFinishedInit)
      browserManager.removeTopLevelItem(this._public);
    browserManager.unregisterItem(this._public);
    this._wasDestroyed = true;
  },

  get parentMenu() {
    return this._parentMenu;
  },

  set parentMenu(val) {
    throw new Error("The 'parentMenu' property is not intended to be set.  " +
                    "Use menu.addItem(item) instead.");
  },

  set _isTopLevel(val) {
    if (val)
      this._workerReg = new WorkerRegistry(this._public);
    else {
      this._workerReg.destroy();
      delete this._workerReg;
    }
  },

  get _topLevelItem() {
    let topLevelItem = this._public;
    let parentMenu = this.parentMenu;
    while (parentMenu) {
      topLevelItem = parentMenu;
      parentMenu = parentMenu.parentMenu;
    }
    return topLevelItem;
  }
});

// Item and Menu are composed of this trait.
const ActiveItemTrait = Trait.compose(ItemBaseTrait, EventEmitter, Trait({

  _initActiveItem: function AIT__initActiveItem(opts, optRules, optsToNotSet) {
    this._initBase(opts, optRules,
                   optsToNotSet.concat(["onMessage", "context"]));

    if ("onMessage" in opts)
      this.on("message", opts.onMessage);

    // When a URL context is removed (by calling context.remove(urlContext)), we
    // may need to create workers for windows containing pages that the item now
    // matches.  Likewise, when a URL context is added, we need to destroy
    // workers for windows containing pages that the item now does not match.
    //
    // collection doesn't provide a way to listen for removals.  utils/registry
    // does, but it doesn't allow its elements to be enumerated.  So as a hack,
    // use a collection for item.context and replace its add and remove methods.
    collection.addCollectionProperty(this, "context");
    if (opts.context)
      this.context.add(opts.context);

    const self = this;

    let add = this.context.add;
    this.context.add = function itemContextAdd() {
      let args = Array.slice(arguments);
      add.apply(self.context, args);
      if (self._workerReg && args.some(function (a) a instanceof URLContext))
        self._workerReg.destroyUnneededWorkers();
    };

    let remove = this.context.remove;
    this.context.remove = function itemContextRemove() {
      let args = Array.slice(arguments);
      remove.apply(self.context, args);
      if (self._workerReg && args.some(function (a) a instanceof URLContext))
        self._workerReg.createNeededWorkers();
    };
  },

  // Workers are only created for top-level menu items.  When a top-level item
  // is later added to a Menu, its workers are destroyed.  Well, all items start
  // out as top-level because there is, unfortunately, no contextMenu.add().  So
  // when an item is created and immediately added to a Menu, workers for it are
  // needlessly created and destroyed.  The point of this timeout is to avoid
  // that.  Items that are created and added to Menus in the same turn of the
  // event loop won't have workers created for them.
  _finishActiveItemInit: function AIT__finishActiveItemInit() {
    numItemsWithUnfinishedInit++;
    const self = this;
    timer.setTimeout(function AIT__finishActiveItemInitTimeout() {
      if (!self.parentMenu && !self._wasDestroyed)
        browserManager.addTopLevelItem(self._public);
      self._hasFinishedInit = true;
      numItemsWithUnfinishedInit--;
    }, 0);
  },

  get label() {
    return this._label;
  },

  set label(val) {
    this._label = validateOpt(val, this._optRules.label);
    if (this._isInited)
      browserManager.setItemLabel(this, this._label);
    return this._label;
  },

  get image() {
    return this._image;
  },

  set image(val) {
    this._image = validateOpt(val, this._optRules.image);
    if (this._isInited)
      browserManager.setItemImage(this, this._image);
    return this._image;
  },

  get contentScript() {
    return this._contentScript;
  },

  set contentScript(val) {
    this._contentScript = validateOpt(val, this._optRules.contentScript);
    return this._contentScript;
  },

  get contentScriptFile() {
    return this._contentScriptFile;
  },

  set contentScriptFile(val) {
    this._contentScriptFile =
      validateOpt(val, this._optRules.contentScriptFile);
    return this._contentScriptFile;
  }
}));

// Item is composed of this trait.
const ItemTrait = Trait.compose(ActiveItemTrait, Trait({

  _initItem: function IT__initItem(opts, optRules) {
    this._initActiveItem(opts, optRules, []);
  },

  get data() {
    return this._data;
  },

  set data(val) {
    this._data = validateOpt(val, this._optRules.data);
    if (this._isInited)
      browserManager.setItemData(this, this._data);
    return this._data;
  },

  toString: function IT_toString() {
    return '[object Item "' + this.label + '"]';
  }
}));

// The exported Item constructor.
function Item(options) {
  let optRules = optionsRules();
  optRules.data = {
    map: function (v) v.toString(),
    is: ["string", "undefined"]
  };

  let item = ItemTrait.create(Item.prototype);
  item._initItem(options, optRules);

  item._public = Cortex(item);
  browserManager.registerItem(item._public);
  item._finishActiveItemInit();

  return item._public;
}

// Menu is composed of this trait.
const MenuTrait = Trait.compose(
  ActiveItemTrait.resolve({ destroy: "_destroyThisItem" }),
  Trait({

  _initMenu: function MT__initMenu(opts, optRules, optsToNotSet) {
    this._items = [];
    this._initActiveItem(opts, optRules, optsToNotSet);
  },

  destroy: function MT_destroy() {
    while (this.items.length)
      this.items[0].destroy();
    this._destroyThisItem();
  },

  get items() {
    return this._items;
  },

  set items(val) {
    let newItems = validateOpt(val, this._optRules.items);
    while (this.items.length)
      this.items[0].destroy();
    newItems.forEach(function (i) this.addItem(i), this);
    return newItems;
  },

  addItem: function MT_addItem(item) {
    // First, remove the item from its current parent.
    let privates = privateItem(item);
    if (item.parentMenu)
      item.parentMenu.removeItem(item);
    else if (!(item instanceof Separator) && privates._hasFinishedInit)
      browserManager.removeTopLevelItem(item);

    // Now add the item to this menu.
    this._items.push(item);
    privates._parentMenu = this._public;
    browserManager.addItemToMenu(item, this._public);
  },

  removeItem: function MT_removeItem(item) {
    let idx = this._items.indexOf(item);
    if (idx < 0)
      return;
    this._items.splice(idx, 1);
    privateItem(item)._parentMenu = null;
    browserManager.removeItemFromMenu(item, this._public);
  },

  toString: function MT_toString() {
    return '[object Menu "' + this.label + '"]';
  }
}));

// The exported Menu constructor.
function Menu(options) {
  let optRules = optionsRules();
  optRules.items = {
    is: ["array"],
    ok: function (v) {
      return v.every(function (item) {
        return (item instanceof Item) ||
               (item instanceof Menu) ||
               (item instanceof Separator);
      });
    },
    msg: "items must be an array, and each element in the array must be an " +
         "Item, Menu, or Separator."
  };

  let menu = MenuTrait.create(Menu.prototype);

  // We can't rely on _initBase to set the `items` property, because the menu
  // needs to be registered with and added to the browserManager before any
  // child items are added to it.
  menu._initMenu(options, optRules, ["items"]);

  menu._public = Cortex(menu);
  browserManager.registerItem(menu._public);
  menu.items = options.items;
  menu._finishActiveItemInit();

  return menu._public;
}

// The exported Separator constructor.
function Separator() {
  let sep = ItemBaseTrait.create(Separator.prototype);
  sep._initBase({}, {}, []);

  sep._public = Cortex(sep);
  browserManager.registerItem(sep._public);
  sep._hasFinishedInit = true;
  return sep._public;
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

    let hasSelection = !win.getSelection().isCollapsed;
    if (!hasSelection) {
      // window.getSelection doesn't return a selection for text selected in a
      // form field (see bug 85686), so before returning false we want to check
      // if the popupNode is a text field.
      let { selectionStart, selectionEnd } = popupNode;
      hasSelection = !isNaN(selectionStart) &&
                     !isNaN(selectionEnd) &&
                     selectionStart !== selectionEnd;
    }
    return hasSelection;
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


// Returns a version of opt validated against the given rule.
function validateOpt(opt, rule) {
  let { opt } = apiUtils.validateOptions({ opt: opt }, { opt: rule });
  return opt;
}

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
    image: {
      map: function (v) v.toString(),
      is: ["string", "undefined", "null"]
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

// Builds an ID suitable for a DOM element from the given item ID.
// isInOverflowSubtree should be true if the returned element will be inserted
// into the DOM subtree rooted at the overflow menu.
function domEltIDFromItemID(itemID, isInOverflowSubtree) {
  let suffix = isInOverflowSubtree ? "-overflow" : "";
  return jpSelf.id + "-context-menu-item-" + itemID + suffix;
}

// Parses the item ID out of the given DOM element ID and returns it.  If the
// element's ID is malformed or it indicates that the element was not created by
// the instance of the module calling this function, returns -1.
function itemIDFromDOMEltID(domEltID) {
  let match = /^(.+?)-context-menu-item-([0-9]+)[-a-z]*$/.exec(domEltID);
  return !match || match[1] !== jpSelf.id ? -1 : match[2];
}

// Returns the private version of the given public reflection.
function privateItem(publicItem) {
  return publicItem.valueOf(PRIVATE_PROPS_KEY);
}


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
    let innerWinID = winUtils.getInnerId(win);
    if ((innerWinID in this.winWorkers) ||
        (innerWinID in this.winsWithoutWorkers))
      return;
    if (this._doesURLNeedWorker(win.document.URL))
      this.winWorkers[innerWinID] = { win: win, worker: this._makeWorker(win) };
    else
      this.winsWithoutWorkers[innerWinID] = win;
  },

  // Unregisters a content window, destroying its related worker if it has one.
  unregisterContentWin: function WR_unregisterContentWin(innerWinID) {
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
    let innerWinID = winUtils.getInnerId(contentWin);
    return (innerWinID in this.winWorkers) ?
           this.winWorkers[innerWinID].worker :
           null;
  },

  // Unregisters all content windows from the registry, which destroys all
  // workers.
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
      window: win,
      contentScript: this.item.contentScript,
      contentScriptFile: this.item.contentScriptFile,
      onError: function (err) console.exception(err)
    });
    let item = this.item;
    worker.on("message", function workerOnMessage(msg) {
      try {
        privateItem(item)._emitOnObject(item, "message", msg);
      }
      catch (err) {
        console.exception(err);
      }
    });
    return worker;
  }
};


// Mirrors state across all browser windows.  Also responsible for detecting
// all content window loads and unloads.
let browserManager = {
  topLevelItems: [],
  browserWins: [],

  // inner window ID => content window
  contentWins: {},

  // Call this when a new item is created, top-level or not.
  registerItem: function BM_registerItem(item) {
    this.browserWins.forEach(function (w) w.registerItem(item));
  },

  // Call this when an item is destroyed and won't be used again, top-level or
  // not.
  unregisterItem: function BM_unregisterItem(item) {
    this.browserWins.forEach(function (w) w.unregisterItem(item));
  },

  addTopLevelItem: function BM_addTopLevelItem(item) {
    this.topLevelItems.push(item);
    this.browserWins.forEach(function (w) w.addTopLevelItem(item));

    // Create the item's worker registry and register all currently loaded
    // content windows with it.
    let privates = privateItem(item);
    privates._isTopLevel = true;
    for each (let win in this.contentWins)
      privates._workerReg.registerContentWin(win);
  },

  removeTopLevelItem: function BM_removeTopLevelItem(item) {
    let idx = this.topLevelItems.indexOf(item);
    if (idx < 0)
      throw new Error("Internal error: item not in top-level menu: " + item);
    this.topLevelItems.splice(idx, 1);
    this.browserWins.forEach(function (w) w.removeTopLevelItem(item));
    privateItem(item)._isTopLevel = false;
  },

  addItemToMenu: function BM_addItemToMenu(item, parentMenu) {
    this.browserWins.forEach(function (w) w.addItemToMenu(item, parentMenu));
  },

  removeItemFromMenu: function BM_removeItemFromMenu(item, parentMenu) {
    this.browserWins.forEach(function (w) w.removeItemFromMenu(item,
                                                               parentMenu));
  },

  setItemLabel: function BM_setItemLabel(item, label) {
    this.browserWins.forEach(function (w) w.setItemLabel(item, label));
  },

  setItemImage: function BM_setItemImage(item, imageURL) {
    this.browserWins.forEach(function (w) w.setItemImage(item, imageURL));
  },

  setItemData: function BM_setItemData(item, data) {
    this.browserWins.forEach(function (w) w.setItemData(item, data));
  },

  // Note that calling this method will cause onTrack to be called immediately
  // for each currently open browser window.
  init: function BM_init() {
    require("api-utils/unload").ensure(this);
    let windowTracker = new winUtils.WindowTracker(this);

    // Register content windows on content-document-global-created and
    // unregister them on inner-window-destroyed.  For rationale, see bug 667957
    // for the former and bug 642004 for the latter.
    observerServ.add("content-document-global-created",
                     this._onDocGlobalCreated, this);
    observerServ.add("inner-window-destroyed",
                     this._onInnerWinDestroyed, this);
  },

  _onDocGlobalCreated: function BM__onDocGlobalCreated(contentWin) {
    let doc = contentWin.document;
    if (doc.readyState == "loading") {
      const self = this;
      doc.addEventListener("readystatechange", function onReadyStateChange(e) {
        if (e.target != doc || doc.readyState != "complete")
          return;
        doc.removeEventListener("readystatechange", onReadyStateChange, false);
        self._registerContentWin(contentWin);
      }, false);
    }
    else if (doc.readyState == "complete")
      this._registerContentWin(contentWin);
  },

  _onInnerWinDestroyed: function BM__onInnerWinDestroyed(subj) {
    this._unregisterContentWin(
      subj.QueryInterface(Ci.nsISupportsPRUint64).data);
  },

  // Stores the given content window with the manager and registers it with each
  // top-level item's worker registry.
  _registerContentWin: function BM__registerContentWin(win) {
    let innerID = winUtils.getInnerId(win);

    // It's an error to call this method for the same window more than once, but
    // we allow it in one case: when onTrack races _onDocGlobalCreated.  (See
    // the comment in onTrack.)  Make sure the window is registered only once.
    if (innerID in this.contentWins)
      return;

    this.contentWins[innerID] = win;
    this.topLevelItems.forEach(function (item) {
      privateItem(item)._workerReg.registerContentWin(win);
    });
  },

  // Removes the given content window from the manager and unregisters it from
  // each top-level item's worker registry.
  _unregisterContentWin: function BM__unregisterContentWin(innerID) {
    delete this.contentWins[innerID];
    this.topLevelItems.forEach(function (item) {
      privateItem(item)._workerReg.unregisterContentWin(innerID);
    });
  },

  unload: function BM_unload() {
    // The window tracker is unloaded at the same time this method is called,
    // which causes onUntrack to be called for each open browser window, so
    // there's no need to clean up browser windows here.

    while (this.topLevelItems.length) {
      let item = this.topLevelItems[0];
      this.removeTopLevelItem(item);
      this.unregisterItem(item);
    }
    delete this.contentWins;
  },

  // Registers a browser window with the manager.  This is a WindowTracker
  // callback.  Note that this is called in two cases:  for each newly opened
  // chrome window, and for each chrome window that is open when the loader
  // loads this module.
  onTrack: function BM_onTrack(window) {
    if (!this._isBrowserWindow(window))
      return;

    let browserWin = new BrowserWindow(window);
    this.browserWins.push(browserWin);

    // Register all loaded content windows in the browser window.  Be sure to
    // include frames and iframes.  If onTrack is called as a result of a new
    // browser window being opened, as opposed to the module being loaded, then
    // this will race the content-document-global-created notification.  That's
    // OK, since _registerContentWin will not register the same content window
    // more than once.
    window.gBrowser.browsers.forEach(function (browser) {
      let topContentWin = browser.contentWindow;
      let allContentWins = Array.slice(topContentWin.frames);
      allContentWins.push(topContentWin);
      allContentWins.forEach(function (contentWin) {
        if (contentWin.document.readyState == "complete")
          this._registerContentWin(contentWin);
      }, this);
    }, this);

    // Add all top-level items and, recursively, their child items to the new
    // browser window.
    function addItemTree(item, parentMenu) {
      browserWin.registerItem(item);
      if (parentMenu)
        browserWin.addItemToMenu(item, parentMenu);
      else
        browserWin.addTopLevelItem(item);
      if (item instanceof Menu)
        item.items.forEach(function (subitem) addItemTree(subitem, item));
    }
    this.topLevelItems.forEach(function (item) addItemTree(item, null));
  },

  // Unregisters a browser window from the manager.  This is a WindowTracker
  // callback.  Note that this is called in two cases:  for each newly closed
  // chrome window, and for each chrome window that is open when this module is
  // unloaded.
  onUntrack: function BM_onUntrack(window) {
    if (!this._isBrowserWindow(window))
      return;

    // Remove the window from the window list.
    let idx = 0;
    for (; idx < this.browserWins.length; idx++)
      if (this.browserWins[idx].window == window)
        break;
    if (idx == this.browserWins.length)
      throw new Error("Internal error: browser window not found");
    let browserWin = this.browserWins.splice(idx, 1)[0];

    // Remove all top-level items from the window.
    this.topLevelItems.forEach(function (i) browserWin.removeTopLevelItem(i));
    browserWin.destroy();
  },

  _isBrowserWindow: function BM__isBrowserWindow(win) {
    let winType = win.document.documentElement.getAttribute("windowtype");
    return winType === "navigator:browser";
  }
};


// Responsible for creating and managing context menu item DOM elements for a
// browser window.  Also responsible for providing a description of the window's
// current context and determining whether an item matches the current context.
//
// TODO: If other apps besides Firefox want to support the context menu in
// whatever way is appropriate for them, plugging in a substitute for or an
// adapter to this class should be the way to do it.  Make it easy for them.
// See bug 560716.
function BrowserWindow(window) {
  this.window = window;
  this.doc = window.document;

  let popupDOMElt = this.doc.getElementById("contentAreaContextMenu");
  if (!popupDOMElt)
    throw new Error("Internal error: Context menu popup not found.");
  this.contextMenuPopup = new ContextMenuPopup(popupDOMElt, this);

  // item ID => { item, domElt, overflowDOMElt, popup, overflowPopup }
  // item may or may not be top-level.  domElt is the item's DOM element
  // contained in the subtree rooted in the top-level context menu.
  // overflowDOMElt is the item's DOM element contained in the subtree rooted in
  // the overflow submenu.  popup and overflowPopup are only defined if the item
  // is a Menu; they're the Popup instances containing the Menu's child items,
  // with the aforementioned distinction between top-level and overflow
  // subtrees.
  this.items = {};
}

BrowserWindow.prototype = {

  // Creates and stores DOM elements for the given item, top-level or not.
  registerItem: function BW_registerItem(item) {
    // this.items[id] is referenced by _makeMenu, so it needs to be defined
    // before _makeDOMElt is called.
    let props = { item: item };
    this.items[privateItem(item)._id] = props;
    props.domElt = this._makeDOMElt(item, false);
    props.overflowDOMElt = this._makeDOMElt(item, true);
  },

  // Removes the given item's DOM elements from the store.
  unregisterItem: function BW_unregisterItem(item) {
    delete this.items[privateItem(item)._id];
  },

  addTopLevelItem: function BW_addTopLevelItem(item) {
    this.contextMenuPopup.addItem(item);
  },

  removeTopLevelItem: function BW_removeTopLevelItem(item) {
    this.contextMenuPopup.removeItem(item);
  },

  addItemToMenu: function BW_addItemToMenu(item, parentMenu) {
    let { popup, overflowPopup } = this.items[privateItem(parentMenu)._id];
    popup.addItem(item);
    overflowPopup.addItem(item);
  },

  removeItemFromMenu: function BW_removeItemFromMenu(item, parentMenu) {
    let { popup, overflowPopup } = this.items[privateItem(parentMenu)._id];
    popup.removeItem(item);
    overflowPopup.removeItem(item);
  },

  setItemLabel: function BW_setItemLabel(item, label) {
    let privates = privateItem(item);
    let { domElt, overflowDOMElt } = this.items[privates._id];
    this._setDOMEltLabel(domElt, label);
    this._setDOMEltLabel(overflowDOMElt, label);
    if (!item.parentMenu && privates._hasFinishedInit)
      this.contextMenuPopup.itemLabelDidChange(item);
  },

  _setDOMEltLabel: function BW__setDOMEltLabel(domElt, label) {
    domElt.setAttribute("label", label);
  },

  setItemImage: function BW_setItemImage(item, imageURL) {
    let { domElt, overflowDOMElt } = this.items[privateItem(item)._id];
    let isMenu = item instanceof Menu;
    this._setDOMEltImage(domElt, imageURL, isMenu);
    this._setDOMEltImage(overflowDOMElt, imageURL, isMenu);
  },

  _setDOMEltImage: function BW__setDOMEltImage(domElt, imageURL, isMenu) {
    if (!imageURL) {
      domElt.removeAttribute("image");
      domElt.classList.remove("menu-iconic");
      domElt.classList.remove("menuitem-iconic");
    }
    else {
      domElt.setAttribute("image", imageURL);
      domElt.classList.add(isMenu ? "menu-iconic" : "menuitem-iconic");
    }
  },

  setItemData: function BW_setItemData(item, data) {
    let { domElt, overflowDOMElt } = this.items[privateItem(item)._id];
    this._setDOMEltData(domElt, data);
    this._setDOMEltData(overflowDOMElt, data);
  },

  _setDOMEltData: function BW__setDOMEltData(domElt, data) {
    domElt.setAttribute("value", data);
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
    let worker = privateItem(item)._workerReg.find(win);

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

  destroy: function BW_destroy() {
    this.contextMenuPopup.destroy();
    delete this.window;
    delete this.doc;
    delete this.items;
  },

  // Emits a click event in the port of the content worker related to given top-
  // level item and popupNode's content window.  Listeners will be passed
  // popupNode and clickedItemData.
  fireClick: function BW_fireClick(topLevelItem, popupNode, clickedItemData) {
    let win = popupNode.ownerDocument.defaultView;
    let worker = privateItem(topLevelItem)._workerReg.find(win);
    if (worker)
      worker.fireClick(popupNode, clickedItemData);
  },

  _makeDOMElt: function BW__makeDOMElt(item, isInOverflowSubtree) {
    let elt = item instanceof Item ? this._makeMenuitem(item) :
              item instanceof Menu ? this._makeMenu(item, isInOverflowSubtree) :
              item instanceof Separator ? this._makeSeparator() :
              null;
    if (!elt)
      throw new Error("Internal error: can't make element, unknown item type");

    elt.id = domEltIDFromItemID(privateItem(item)._id, isInOverflowSubtree);
    elt.classList.add(ITEM_CLASS);
    return elt;
  },

  // Returns a new xul:menu representing the menu.
  _makeMenu: function BW__makeMenu(menu, isInOverflowSubtree) {
    let menuElt = this.doc.createElement("menu");
    this._setDOMEltLabel(menuElt, menu.label);
    if (menu.image)
      this._setDOMEltImage(menuElt, menu.image, true);
    let popupElt = this.doc.createElement("menupopup");
    menuElt.appendChild(popupElt);

    let popup = new Popup(popupElt, this, isInOverflowSubtree);
    let props = this.items[privateItem(menu)._id];
    if (isInOverflowSubtree)
      props.overflowPopup = popup;
    else
      props.popup = popup;

    return menuElt;
  },

  // Returns a new xul:menuitem representing the item.
  _makeMenuitem: function BW__makeMenuitem(item) {
    let elt = this.doc.createElement("menuitem");
    this._setDOMEltLabel(elt, item.label);
    if (item.image)
      this._setDOMEltImage(elt, item.image, false);
    if (item.data)
      this._setDOMEltData(elt, item.data);
    return elt;
  },

  // Returns a new xul:menuseparator.
  _makeSeparator: function BW__makeSeparator() {
    return this.doc.createElement("menuseparator");
  }
};


// Responsible for adding DOM elements to and removing them from poupDOMElt.
function Popup(popupDOMElt, browserWin, isInOverflowSubtree) {
  this.popupDOMElt = popupDOMElt;
  this.browserWin = browserWin;
  this.isInOverflowSubtree = isInOverflowSubtree;
}

Popup.prototype = {

  addItem: function Popup_addItem(item) {
    let props = this.browserWin.items[privateItem(item)._id];
    let elt = this.isInOverflowSubtree ? props.overflowDOMElt : props.domElt;
    this.popupDOMElt.appendChild(elt);
  },

  removeItem: function Popup_removeItem(item) {
    let props = this.browserWin.items[privateItem(item)._id];
    let elt = this.isInOverflowSubtree ? props.overflowDOMElt : props.domElt;
    this.popupDOMElt.removeChild(elt);
  }
};


// Represents a browser window's context menu popup.  Responsible for hiding and
// showing items according to the browser window's current context and for
// handling item clicks.
function ContextMenuPopup(popupDOMElt, browserWin) {
  this.popupDOMElt = popupDOMElt;
  this.browserWin = browserWin;
  this.doc = popupDOMElt.ownerDocument;

  // item ID => item
  // Calling this variable "topLevelItems" is redundant, since Popup and
  // ContextMenuPopup are only responsible for their child items, not all their
  // descendant items.  But calling it "items" might encourage one to believe
  // otherwise, so topLevelItems it is.
  this.topLevelItems = {};

  popupDOMElt.addEventListener("popupshowing", this, false);
  popupDOMElt.addEventListener("command", this, false);
}

ContextMenuPopup.prototype = {

  addItem: function CMP_addItem(item) {
    this._ensureStaticEltsExist();
    let itemID = privateItem(item)._id;
    this.topLevelItems[itemID] = item;
    let props = this.browserWin.items[itemID];
    props.domElt.classList.add(TOPLEVEL_ITEM_CLASS);
    props.overflowDOMElt.classList.add(OVERFLOW_ITEM_CLASS);
    this._insertItemInSortedOrder(item);
  },

  removeItem: function CMP_removeItem(item) {
    let itemID = privateItem(item)._id;
    delete this.topLevelItems[itemID];
    let { domElt, overflowDOMElt } = this.browserWin.items[itemID];
    domElt.classList.remove(TOPLEVEL_ITEM_CLASS);
    overflowDOMElt.classList.remove(OVERFLOW_ITEM_CLASS);
    this.popupDOMElt.removeChild(domElt);
    this._overflowPopup.removeChild(overflowDOMElt);
  },

  // Call this after the item's label changes.  This re-inserts the item into
  // the popup so that it remains in sorted order.
  itemLabelDidChange: function CMP_itemLabelDidChange(item) {
    let itemID = privateItem(item)._id;
    let { domElt, overflowDOMElt } = this.browserWin.items[itemID];
    this.popupDOMElt.removeChild(domElt);
    this._overflowPopup.removeChild(overflowDOMElt);
    this._insertItemInSortedOrder(item);
  },

  destroy: function CMP_destroy() {
    // If there are no more items from any instance of the module, remove the
    // separator and overflow submenu, if they exist.
    let elts = this._topLevelElts;
    if (!elts.length) {
      let submenu = this._overflowMenu;
      if (submenu)
        this.popupDOMElt.removeChild(submenu);

      let sep = this._separator;
      if (sep)
        this.popupDOMElt.removeChild(sep);
    }

    this.popupDOMElt.removeEventListener("popupshowing", this, false);
    this.popupDOMElt.removeEventListener("command", this, false);
  },

  handleEvent: function CMP_handleEvent(event) {
    try {
      if (event.type === "command")
        this._handleClick(event.target);
      else if (event.type === "popupshowing" &&
               event.target === this.popupDOMElt)
        this._handlePopupShowing();
    }
    catch (err) {
      console.exception(err);
    }
  },

  // command events bubble to the context menu's top-level xul:menupopup and are
  // caught here.
  _handleClick: function CMP__handleClick(clickedDOMElt) {
    if (!clickedDOMElt.classList.contains(ITEM_CLASS))
      return;
    let itemID = itemIDFromDOMEltID(clickedDOMElt.id);
    if (itemID < 0)
      return;
    let { item, domElt, overflowDOMElt } = this.browserWin.items[itemID];

    // Bail if the DOM element was not created by this module instance.  In
    // real-world add-ons, the itemID < 0 check above is sufficient, but for the
    // unit test the JID never changes, making this necessary.
    if (clickedDOMElt != domElt && clickedDOMElt != overflowDOMElt)
      return;

    let topLevelItem = privateItem(item)._topLevelItem;
    let popupNode = this.browserWin.adjustPopupNode(this.browserWin.popupNode,
                                                    topLevelItem);
    this.browserWin.fireClick(topLevelItem, popupNode, item.data);
  },

  // popupshowing is used to show top-level items that match the browser
  // window's current context and hide items that don't.  Each module instance
  // is responsible for showing and hiding the items it owns.
  _handlePopupShowing: function CMP__handlePopupShowing() {
    // If there are items queued up to finish initializing, let them go first.
    // Otherwise the overflow submenu and menu separator may end up in an
    // inappropriate state when those items are later added to the menu.
    if (numItemsWithUnfinishedInit) {
      const self = this;
      timer.setTimeout(function popupShowingTryAgain() {
        self._handlePopupShowing();
      }, 0);
      return;
    }

    // popupDOMElt.triggerNode was added in Gecko 2.0 by bug 383930.  The || is
    // to avoid a Spidermonkey strict warning on earlier versions.
    let triggerNode = this.popupDOMElt.triggerNode || undefined;
    let popupNode = this.browserWin.capturePopupNode(triggerNode);

    // Show and hide items.  Set a "jetpackContextCurrent" property on the
    // DOM elements to signal which of our items match the current context.
    for (let [itemID, item] in Iterator(this.topLevelItems)) {
      let areContextsCurr =
        this.browserWin.areAllContextsCurrent(item, popupNode);

      // Change the item's label if the return value was a string.
      if (typeof(areContextsCurr) === "string") {
        item.label = areContextsCurr;
        areContextsCurr = true;
      }

      let { domElt, overflowDOMElt } = this.browserWin.items[itemID];
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
    let elts = this._topLevelElts;
    let numShown = Array.reduce(elts, function (total, elt) {
      return total + (elt.jetpackContextCurrent ? 1 : 0);
    }, 0);

    // If too many items are shown, show the submenu and hide the top-level
    // items.  Otherwise, hide the submenu and show the top-level items.
    let overflow = numShown > this._overflowThreshold;
    if (overflow)
      Array.forEach(elts, function (e) e.hidden = true);

    let submenu = this._overflowMenu;
    if (submenu)
      submenu.hidden = !overflow;

    // If no items are shown, hide the menu separator.
    let sep = this._separator;
    if (sep)
      sep.hidden = numShown === 0;
  },

  // Adds the menu separator and overflow submenu if they don't exist.
  _ensureStaticEltsExist: function CMP__ensureStaticEltsExist() {
    let sep = this._separator;
    if (!sep) {
      sep = this._makeSeparator();
      this.popupDOMElt.appendChild(sep);
    }

    let submenu = this._overflowMenu;
    if (!submenu) {
      submenu = this._makeOverflowMenu();
      submenu.hidden = true;
      this.popupDOMElt.insertBefore(submenu, sep.nextSibling);
    }
  },

  // Inserts the given item's DOM element into the popup in sorted order.
  _insertItemInSortedOrder: function CMP__insertItemInSortedOrder(item) {
    let props = this.browserWin.items[privateItem(item)._id];
    this.popupDOMElt.insertBefore(
      props.domElt, insertionPoint(item.label, this._topLevelElts));
    this._overflowPopup.insertBefore(
      props.overflowDOMElt, insertionPoint(item.label, this._overflowElts));
  },

  // Creates and returns the xul:menu that's shown when too many items are added
  // to the popup.
  _makeOverflowMenu: function CMP__makeOverflowMenu() {
    let submenu = this.doc.createElement("menu");
    submenu.id = OVERFLOW_MENU_ID;
    submenu.setAttribute("label", OVERFLOW_MENU_LABEL);
    let popup = this.doc.createElement("menupopup");
    popup.id = OVERFLOW_POPUP_ID;
    submenu.appendChild(popup);
    return submenu;
  },

  // Creates and returns the xul:menuseparator that separates the standard
  // context menu items from our items.
  _makeSeparator: function CMP__makeSeparator() {
    let elt = this.doc.createElement("menuseparator");
    elt.id = SEPARATOR_ID;
    return elt;
  },

  // Returns the item elements contained in the overflow menu, a NodeList.
  get _overflowElts() {
    return this._overflowPopup.getElementsByClassName(OVERFLOW_ITEM_CLASS);
  },

  // Returns the overflow xul:menu.
  get _overflowMenu() {
    return this.doc.getElementById(OVERFLOW_MENU_ID);
  },

  // Returns the overflow xul:menupopup.
  get _overflowPopup() {
    return this.doc.getElementById(OVERFLOW_POPUP_ID);
  },

  // Returns the OVERFLOW_THRESH_PREF pref value if it exists or
  // OVERFLOW_THRESH_DEFAULT if it doesn't.
  get _overflowThreshold() {
    let prefs = require("api-utils/preferences-service");
    return prefs.get(OVERFLOW_THRESH_PREF, OVERFLOW_THRESH_DEFAULT);
  },

  // Returns the xul:menuseparator.
  get _separator() {
    return this.doc.getElementById(SEPARATOR_ID);
  },

  // Returns the item elements contained in the top-level menu, a NodeList.
  get _topLevelElts() {
    return this.popupDOMElt.getElementsByClassName(TOPLEVEL_ITEM_CLASS);
  }
};


// Init the browserManager only after setting prototypes and such above, because
// it will cause browserManager.onTrack to be called immediately if there are
// open windows.
browserManager.init();
