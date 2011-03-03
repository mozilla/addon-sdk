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
 *   Dietrich Ayala <dietrich@mozilla.com> (Original Author)
 *   Drew Willcoxon <adw@mozilla.com>
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

const {Cc, Ci} = require("chrome");

// Widget content types
const CONTENT_TYPE_URI    = 1;
const CONTENT_TYPE_HTML   = 2;
const CONTENT_TYPE_IMAGE  = 3;

const ERR_CONTENT = "No content or contentURL property found. Widgets must "
                         + "have one or the other.",
      ERR_LABEL = "The widget must have a non-empty label property.";

// Supported events, mapping from DOM event names to our event names
const EVENTS = {
  "click": "click",
  "mouseover": "mouseover",
  "mouseout": "mouseout",
};

if (!require("xul-app").is("Firefox")) {
  throw new Error([
    "The widget module currently supports only Firefox.  In the future ",
    "it will support other applications. Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=560716 for more information."
  ].join(""));
}

const { validateOptions } = require("api-utils");
const panels = require("panel");
const { EventEmitter } = require("events");
const { Trait } = require("traits");
const { Loader, Symbiont } = require("content");

const valid = {
  number: { is: ["null", "undefined", "number"] },
  string: { is: ["null", "undefined", "string"] },
  label: {
    is: ["string"],
    ok: function (v) v.length > 0,
    msg: ERR_LABEL
  },
  panel: {
    is: ["null", "undefined", "object"],
    ok: function(v) !v || v instanceof panels.Panel
  }
}

function validate(name, suspect, validation) {
  let $1 = {}
  $1[name] = suspect
  let $2 = {}
  $2[name] = validation
  return validateOptions($1, $2)[name]
}

const eventBus = Trait.compose(EventEmitter, Trait.compose({
  constructor: function EventBus() this
}))();

// The widget object.
const Widget = Trait.compose(Loader, Trait.compose({
  constructor: function Widget(options) {

    eventBus.on('event', this._onEvent.bind(this));
    this.on('error', this._defaultErrorHandler.bind(this));

    this._label = validate("label", options.label, valid.label);

    this.tooltip = "tooltip" in options ? options.tooltip : this._label

    if ("width" in options)
      this.width = options.width;
    if ("panel" in options)
      this.panel = options.panel;

    if ("onClick" in options)
      this.on("click", options.onClick);
    if ("onMouseover" in options)
      this.on("mouseover", options.onMouseover);
    if ("onMouseout" in options)
      this.on("mouseout", options.onMouseout);
    if ("content" in options)
      this._content = options.content;
    if ("contentURL" in options)
      this.contentURL = options.contentURL;

    if ("contentScriptWhen" in options)
      this.contentScriptWhen = options.contentScriptWhen;
    if ("contentScriptFile" in options)
      this.contentScriptFile = options.contentScriptFile;
    if ("contentScript" in options)
      this.contentScript = options.contentScript;
    if ("allow" in options)
      this.allow = options.allow;
    if ("onError" in options)
      this.on("error", options.onError);
    if ("onMessage" in options)
        this.on("message", options.onMessage);

    if (!(this._content || this.contentURL))
      throw new Error(ERR_CONTENT);

    let self = this;
    this.on('propertyChange', function(change) {
      if ('contentURL' in change)
        browserManager.updateItem(self._public, "contentURL", self.contentURL);
    });

    browserManager.addItem(this._public);
  },

  _defaultErrorHandler: function Widget__defaultErrorHandler(e) {
    if (1 == this._listeners('error').length)
      console.exception(e)
  },

  _onEvent: function Widget__onEvent(type, target, eventData, domNode) {
    if (target === this._public) {
      this._emit(type, eventData);

      // Special case for click events: if the widget doesn't have a click
      // handler, but it does have a panel, display the panel.
      if ("click" == type && !this._listeners("click").length && this.panel)
        this.panel.show(domNode);
    }
  },

  get label() this._label,
  _label: null,

  get width() this._width,
  set width(value) {
    value = validate("width", value, valid.number);
    if (null === value || undefined === value) value = 16;
    if (value !== this._width)
      browserManager.updateItem(this._public, "width", this._width = value);
  },
  _width: 16,

  get tooltip() this._tooltip,
  set tooltip(value) {
    value = validate("tooltip", value, valid.string);
    if (value !== this._tooltip)
      browserManager.updateItem(this._public, "tooltip", this._tooltip = value);
  },
  _tooltip: null,

  get content() this._content,
  set content(value) {
    value = validate("content", value, valid.string);
    if (value !== this._content)
      browserManager.updateItem(this._public, "content", this._content = value);
  },
  _content: null,

  get panel() this._panel,
  set panel(value) {
    value = validate("panel", value, valid.panel);
    if (value !== this._panel)
      this._panel = value;
  },
  _panel: null,

  postMessage: function Widget_postMessage(message) {
    browserManager.updateItem(this._public, "postMessage", message);
  },

  destroy: function Widget_destroy() {
    browserManager.removeItem(this._public);
  }
}));
exports.Widget = function(options) Widget(options);
exports.Widget.prototype = Widget.prototype;

// Keeps track of all browser windows.
// Exposes methods for adding/removing/updating widgets
// across all open windows (and future ones).
let browserManager = {
  items: [],
  windows: [],

  // Registers the manager to listen for window openings and closings.  Note
  // that calling this method can cause onTrack to be called immediately if
  // there are open windows.
  init: function () {
    let windowTracker = new (require("window-utils").WindowTracker)(this);
    require("unload").ensure(windowTracker);
  },

  // Registers a window with the manager.  This is a WindowTracker callback.
  onTrack: function browserManager_onTrack(window) {
    if (this._isBrowserWindow(window)) {
      let win = new BrowserWindow(window);
      win.addItems(this.items);
      this.windows.push(win);
    }
  },

  // Unregisters a window from the manager.  It's told to undo all 
  // modifications.  This is a WindowTracker callback.  Note that when
  // WindowTracker is unloaded, it calls onUntrack for every currently opened
  // window.  The browserManager therefore doesn't need to specially handle
  // unload itself, since unloading the browserManager means untracking all
  // currently opened windows.
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

  // Registers an item with the manager. It's added to the add-on bar of
  // all currently registered windows, and when new windows are registered it
  // will be added to them, too.
  addItem: function browserManager_addItem(item) {
    let idx = this.items.indexOf(item);
    if (idx > -1)
      throw new Error("The widget " + item + " has already been added.");
    this.items.push(item);
    this.windows.forEach(function (w) w.addItems([item]));
  },

  // Updates the content of an item registered with the manager,
  // propagating the change to all windows.
  updateItem: function browserManager_updateItem(item, property, value) {
    let idx = this.items.indexOf(item);
    if (idx != -1)
      this.windows.forEach(function (w) w.updateItem(item, property, value));
  },

  // Unregisters an item from the manager.  It's removed from the addon-bar
  // of all windows that are currently registered.
  removeItem: function browserManager_removeItem(item) {
    let idx = this.items.indexOf(item);
    if (idx > -1) {
      this.items.splice(idx, 1);
      if (item.panel)
        item.panel.destroy();
      this.windows.forEach(function (w) w.removeItems([item]));
    }
  },

  _isBrowserWindow: function browserManager__isBrowserWindow(win) {
    let winType = win.document.documentElement.getAttribute("windowtype");
    return winType === "navigator:browser";
  }
};

// Keeps track of a single browser window.  Responsible for providing a
// description of the window's current context and determining whether an item
// matches the current context.
//
// This is where the core of how a widget's content is added to a window lives.
//
// TODO: If other apps besides Firefox want to support the add-on bar in
// whatever way is appropriate for them, plugging in a substitute for this class
// should be the way to do it.  Make it easy for them.  See bug 560716.
function BrowserWindow(window) {
  this.window = window;
  this.doc = window.document;
  this._init();
}

BrowserWindow.prototype = {

  _init: function BW__init() {
    // Array of objects:
    // {
    //   widget: widget object,
    //   node: dom node,
    //   eventListeners: hash of event listeners
    //   symbiont: contentSymbiont
    // }
    this._items = [];
    
  },

  get container() {
    if (!this._container) {
      // If being run in a version of Firefox <4, create a separate
      // addon bar. TODO: just use the status bar?
      let container = this.doc.getElementById("addon-bar");
      if (!container) {
        let toolbox = this.doc.createElement("toolbox");

        // Share browser's palette.
        let browserToolbox = this.doc.getElementById("navigator-toolbox");
        toolbox.palette = browserToolbox.palette;

        container = this.doc.createElement("toolbar");
        container.setAttribute("id", "addon-bar");
        container.setAttribute("customizable", "true");
        // TODO: needs localization
        container.setAttribute("toolbarname", "Add-ons Toolbar");

        container.setAttribute("align", "right");
        container.style.minHeight = "18px";
        container.style.padding = "2px";
        container.style.margin = "0px";

        toolbox.appendChild(container);

        let statusbar = this.doc.getElementById("status-bar");
        statusbar.parentNode.insertBefore(toolbox, statusbar);
      }

      this._container = container;
    }
    return this._container;
  },

  // Hide container
  _hideContainer: function BW__hideContainer() {
    if (this._container)
      this._container.collapsed = true;
  },

  // Update the visibility state for the addon bar.
  _onToggleUI: function BW__onToggleUI() {
    this.container.collapsed = !this.container.collapsed;
  },

  // Adds an array of items to the window.
  addItems: function BW_addItems(items) {
    items.forEach(this._addItemToWindow, this);
  },

  // Update a property of a widget.
  updateItem: function BW_updateItem(updatedItem, property, value) {
    let item = this._items.filter(function(item) item.widget == updatedItem).shift();
    if (item) {
      switch(property) {
        case "contentURL":
        case "content":
          this.setContent(item);
          break;
        case "width":
          item.node.style.minWidth = value + "px";
          item.node.querySelector("iframe").style.width = value + "px";
          break;
        case "tooltip":
          item.node.setAttribute("tooltiptext", value);
          break;
        case "postMessage":
          item.symbiont.postMessage(value);
          break;
      }
    }
  },

  // Add a widget to this window.
  _addItemToWindow: function BW__addItemToWindow(widget) {
    // XUL element container for widget
    let node = this.doc.createElement("toolbaritem");
    let guid = require("xpcom").makeUuid().toString();
    let id = "widget:" + guid;
    node.setAttribute("id", id);
    node.setAttribute("label", widget.label);
    node.setAttribute("tooltiptext", widget.tooltip);
    node.setAttribute("align", "center");

    // TODO move into a stylesheet, configurable by consumers.
    // Either widget.style, exposing the style object, or a URL
    // (eg, can load local stylesheet file).
    node.setAttribute("style", [
        "overflow: hidden; margin: 1px 2px 1px 2px; padding: 0px;",
        "min-height: 16px;",
    ].join(""));

    node.style.minWidth = widget.width + "px";

    // Add to the customization palette
    let toolbox = this.doc.getElementById("navigator-toolbox");
    let palette = toolbox.palette;
    palette.appendChild(node);

    // Add the item to the toolbar
    this.container.insertItem(id, null, null, false);

    let item = {widget: widget, node: node};

    this._fillItem(item);

    this._items.push(item);

    if (this.container.collapsed)
      this._onToggleUI();
  },

  // Initial population of a widget's content.
  _fillItem: function BS__fillItem(item) {
    // Create element
    var iframe = this.doc.createElement("iframe");
    iframe.setAttribute("type", "content");
    iframe.setAttribute("transparent", "transparent");
    iframe.style.overflow = "hidden";
    iframe.style.height = "16px";
    iframe.style.maxHeight = "16px";
    iframe.style.width = item.widget.width + "px";
    iframe.setAttribute("flex", "1");
    iframe.style.border = "none";
    iframe.style.padding = "0px";
    
    // Do this early, because things like contentWindow are null
    // until the node is attached to a document.
    item.node.appendChild(iframe);

    // add event handlers
    this.addEventHandlers(item);

    // set content
    this.setContent(item);
  },

  // Get widget content type.
  getContentType: function BW_getContentType(widget) {
    if (widget.content)
      return CONTENT_TYPE_HTML;
    return (widget.contentURL && /\.(jpg|gif|png|ico)$/.test(widget.contentURL))
      ? CONTENT_TYPE_IMAGE : CONTENT_TYPE_URI;
  },

  // Set widget content.
  setContent: function BW_setContent(item) {
    let type = this.getContentType(item.widget);
    let contentURL = null;

    switch (type) {
      case CONTENT_TYPE_HTML:
        contentURL = "data:text/html," + encodeURI(item.widget.content);
        break;
      case CONTENT_TYPE_URI:
        contentURL = item.widget.contentURL;
        break;
      case CONTENT_TYPE_IMAGE:
        let imageURL = item.widget.contentURL;
        contentURL = "data:text/html,<html><body><img src='" +
                     encodeURI(imageURL) + "'></body></html>";
        break;
      default:
        throw new Error("The widget's type cannot be determined.");
    }

    let iframe = item.node.firstElementChild;

    item.symbiont = Symbiont({
      frame: iframe,
      contentURL: contentURL,
      contentScriptFile: item.widget.contentScriptFile,
      contentScript: item.widget.contentScript,
      contentScriptWhen: item.widget.contentScriptWhen,
      allow: item.widget.allow,
      onMessage: function(message) {
        require("timer").setTimeout(function() {
          eventBus._emit("event", "message", item.widget, message);
        }, 0);
      }
    });
  },

  // Set up all supported events for a widget.
  addEventHandlers: function BW_addEventHandlers(item) {
    let contentType = this.getContentType(item.widget);

    // Detect if document consists of a single image.
    function isImageDoc(doc) {
      return doc.body.childNodes.length == 1 &&
             doc.body.firstElementChild &&
             doc.body.firstElementChild.tagName == "IMG";
    }

    let listener = function(e) {
      // Ignore event firings that target the iframe
      if (e.target == item.node.firstElementChild)
        return;

      // Proxy event to the widget
      require("timer").setTimeout(function() {
        eventBus._emit("event", EVENTS[e.type], item.widget, null, item.node);
      }, 0);
    };

    item.eventListeners = {};
    let iframe = item.node.firstElementChild;
    for (let [type, method] in Iterator(EVENTS)) {
      iframe.addEventListener(type, listener, true, true);

      // Store listeners for later removal
      item.eventListeners[type] = listener;
    }
    
    // On document load, make modifications required for nice default
    // presentation.
    function loadListener(e) {
      // Ignore event firings that target the iframe
      if (e.target == iframe)
        return;
      // Ignore about:blank loads
      if (e.type == "load" && e.target.location == "about:blank")
        return;
      let doc = e.target;
      if (contentType == CONTENT_TYPE_IMAGE || isImageDoc(doc)) {
        // Force image content to size.
        // Add-on authors must size their images correctly.
        doc.body.firstElementChild.style.width = item.widget.width + "px";
        doc.body.firstElementChild.style.height = "16px";
      }

      // Allow all content to fill the box by default.
      doc.body.style.margin = "0";
    }
    iframe.addEventListener("load", loadListener, true, true);
    item.eventListeners["load"] = loadListener;
  },

  // Removes an array of items from the window.
  removeItems: function BW_removeItems(removedItems) {
    removedItems.forEach(function(removedItem) {
      let entry = this._items.filter(function(entry) entry.widget == removedItem).shift();
      if (entry) {
        // remove event listeners
        for (let [type, listener] in Iterator(entry.eventListeners))
          entry.node.firstElementChild.removeEventListener(type, listener, true);
        // remove dom node
        this.container.removeChild(entry.node);
        // remove entry
        this._items.splice(this._items.indexOf(entry), 1);
      }
    }, this);

    // remove the add-on bar if no more items
    if (this.container.getElementsByTagName("toolbaritem").length == 0)
      this._hideContainer();
  },

  // Undoes all modifications to the window. The BrowserWindow
  // should not be used afterward.
  destroy: function BW_destroy() {
    // Remove all items from the panel
    let len = this._items.length;
    for (let i = 0; i < len; i++)
      this.removeItems([this._items[0].widget]);

    this.window.removeEventListener("keypress", this, false);
  }
};

// Init the browserManager only after setting prototypes and such above, because
// it will cause browserManager.onTrack to be called immediately if there are
// open windows.
browserManager.init();
