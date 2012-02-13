/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { EventEmitter } = require('./events'),
      { Trait } = require('./traits');
const { when } = require('./unload');
const errors = require("./errors");

const gWindowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                       getService(Ci.nsIWindowWatcher);
const appShellService = Cc["@mozilla.org/appshell/appShellService;1"].
                        getService(Ci.nsIAppShellService);

const XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

/**
 * An iterator for XUL windows currently in the application.
 *
 * @return A generator that yields XUL windows exposing the
 *         nsIDOMWindow interface.
 */
var windowIterator = exports.windowIterator = function windowIterator() {
  let winEnum = gWindowWatcher.getWindowEnumerator();
  while (winEnum.hasMoreElements())
    yield winEnum.getNext().QueryInterface(Ci.nsIDOMWindow);
};

/**
 * An iterator for browser windows currently open in the application.
 * @returns {Function}
 *    A generator that yields browser windows exposing the `nsIDOMWindow`
 *    interface.
 */
function browserWindowIterator() {
  for each (let window in windowIterator()) {
    if (isBrowser(window))
      yield window;
  }
}
exports.browserWindowIterator = browserWindowIterator;

var WindowTracker = exports.WindowTracker = function WindowTracker(delegate) {
   if (!(this instanceof WindowTracker)) {
     return new WindowTracker(delegate);
   }

  this._delegate = delegate;
  this._loadingWindows = [];

  for (let window in windowIterator())
    this._regWindow(window);
  gWindowWatcher.registerNotification(this);

  require("./unload").ensure(this);

  return this;
};

WindowTracker.prototype = {
  _regLoadingWindow: function _regLoadingWindow(window) {
    this._loadingWindows.push(window);
    window.addEventListener("load", this, true);
  },

  _unregLoadingWindow: function _unregLoadingWindow(window) {
    var index = this._loadingWindows.indexOf(window);

    if (index != -1) {
      this._loadingWindows.splice(index, 1);
      window.removeEventListener("load", this, true);
    }
  },

  _regWindow: function _regWindow(window) {
    if (window.document.readyState == "complete") {
      this._unregLoadingWindow(window);
      this._delegate.onTrack(window);
    } else
      this._regLoadingWindow(window);
  },

  _unregWindow: function _unregWindow(window) {
    if (window.document.readyState == "complete") {
      if (this._delegate.onUntrack)
        this._delegate.onUntrack(window);
    } else {
      this._unregLoadingWindow(window);
    }
  },

  unload: function unload() {
    gWindowWatcher.unregisterNotification(this);
    for (let window in windowIterator())
      this._unregWindow(window);
  },

  handleEvent: errors.catchAndLog(function handleEvent(event) {
    if (event.type == "load" && event.target) {
      var window = event.target.defaultView;
      if (window)
        this._regWindow(window);
    }
  }),

  observe: errors.catchAndLog(function observe(subject, topic, data) {
    var window = subject.QueryInterface(Ci.nsIDOMWindow);
    if (topic == "domwindowopened")
      this._regWindow(window);
    else
      this._unregWindow(window);
  })
};

const WindowTrackerTrait = Trait.compose({
  _onTrack: Trait.required,
  _onUntrack: Trait.required,
  constructor: function WindowTrackerTrait() {
    WindowTracker({
      onTrack: this._onTrack.bind(this),
      onUntrack: this._onUntrack.bind(this)
    });
  }
});
exports.WindowTrackerTrait = WindowTrackerTrait;

var gDocsToClose = [];

function onDocUnload(event) {
  var index = gDocsToClose.indexOf(event.target);
  if (index == -1)
    throw new Error("internal error: unloading document not found");
  var document = gDocsToClose.splice(index, 1)[0];
  // Just in case, let's remove the event listener too.
  document.defaultView.removeEventListener("unload", onDocUnload, false);
}

onDocUnload = require("./errors").catchAndLog(onDocUnload);

exports.closeOnUnload = function closeOnUnload(window) {
  window.addEventListener("unload", onDocUnload, false);
  gDocsToClose.push(window.document);
};

exports.__defineGetter__("activeWindow", function() {
  return Cc["@mozilla.org/appshell/window-mediator;1"]
         .getService(Ci.nsIWindowMediator)
         .getMostRecentWindow(null);
});
exports.__defineSetter__("activeWindow", function(window) {
  try {
    window.focus();
  }
  catch (e) { }
});

exports.__defineGetter__("activeBrowserWindow", function() {
  return Cc["@mozilla.org/appshell/window-mediator;1"]
         .getService(Ci.nsIWindowMediator)
         .getMostRecentWindow("navigator:browser");
});

/**
 * Returns the ID of the window's current inner window.
 */
exports.getInnerId = function getInnerId(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
                getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
};

/**
 * Returns the ID of the window's outer window.
 */
exports.getOuterId = function getOuterId(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
                getInterface(Ci.nsIDOMWindowUtils).outerWindowID;
};

function isBrowser(window) {
  return window.document.documentElement.getAttribute("windowtype") ===
         "navigator:browser";
};
exports.isBrowser = isBrowser;

exports.hiddenWindow = appShellService.hiddenDOMWindow;

function createHiddenXULFrame() {
  return function promise(deliver) {
    let window = appShellService.hiddenDOMWindow;
    let document = window.document;
    let isXMLDoc = (document.contentType == "application/xhtml+xml" ||
                    document.contentType == "application/vnd.mozilla.xul+xml")

    if (isXMLDoc) {
      deliver(window)
    }
    else {
      let frame = document.createElement('iframe');
      // This is ugly but we need window for XUL document in order to create
      // browser elements.
      frame.setAttribute('src', 'chrome://browser/content/hiddenWindow.xul');
      frame.addEventListener('DOMContentLoaded', function onLoad(event) {
        frame.removeEventListener('DOMContentLoaded', onLoad, false);
        deliver(frame.contentWindow);
      }, false);
      document.documentElement.appendChild(frame);
    }
  }
};
exports.createHiddenXULFrame = createHiddenXULFrame;

exports.createRemoteBrowser = function createRemoteBrowser(remote) {
  return function promise(deliver) {
    createHiddenXULFrame()(function(hiddenWindow) {
      let document = hiddenWindow.document;
      let browser = document.createElementNS(XUL, "browser");
      // Remote="true" enable everything here:
      // http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1347
      if (remote !== false)
        browser.setAttribute("remote","true");
      // Type="content" is mandatory to enable stuff here:
      // http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1776
      browser.setAttribute("type","content");
      // We remove XBL binding to avoid execution of code that is not going to work
      // because browser has no docShell attribute in remote mode (for example)
      browser.setAttribute("style","-moz-binding: none;");
      // Flex it in order to be visible (optional, for debug purpose)
      browser.setAttribute("flex", "1");
      document.documentElement.appendChild(browser);

      // Bug 724433: do not leak this <browser> DOM node
      when(function () {
        document.documentElement.removeChild(browser);
      });

      // Return browser
      deliver(browser);
    });
  };
};

require("./unload").when(
  function() {
    gDocsToClose.slice().forEach(
      function(doc) { doc.defaultView.close(); });
  });
