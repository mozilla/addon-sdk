/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { EventEmitter } = require('./events');
const { Trait } = require('./traits');
const { when } = require('./unload');
const { getInnerId, getOuterId } = require('./window-utils');
const errors = require("./errors");

const windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                       getService(Ci.nsIWindowWatcher);
const appShellService = Cc["@mozilla.org/appshell/appShellService;1"].
                        getService(Ci.nsIAppShellService);

/**
 * An iterator for XUL windows currently in the application.
 *
 * @return A generator that yields XUL windows exposing the
 *         nsIDOMWindow interface.
 */
function windowIterator() {
  let winEnum = windowWatcher.getWindowEnumerator();
  while (winEnum.hasMoreElements())
    yield winEnum.getNext().QueryInterface(Ci.nsIDOMWindow);
};
exports.windowIterator = windowIterator;

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

function WindowTracker(delegate) {
   if (!(this instanceof WindowTracker)) {
     return new WindowTracker(delegate);
   }

  this._delegate = delegate;
  this._loadingWindows = [];

  for (let window in windowIterator())
    this._regWindow(window);
  windowWatcher.registerNotification(this);

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
    windowWatcher.unregisterNotification(this);
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
exports.WindowTracker = WindowTracker;

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

Object.defineProperties(exports, {
  activeWindow: {
    enumerable: true,
    get: function() {
      return Cc["@mozilla.org/appshell/window-mediator;1"]
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow(null);
    },
    set: function(window) {
      try { window.focus(); } catch (e) { }
    }
  },
  activeBrowserWindow: {
    enumerable: true,
    get: function() {
      return Cc["@mozilla.org/appshell/window-mediator;1"]
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow("navigator:browser");
    }
  }
});


/**
 * Returns the ID of the window's current inner window.
 */
exports.getInnerId = function(window) {
  console.warn('require("window-utils").getInnerId is deprecated, ' +
               'please use require("window/utils").getInnerId instead');
  return getInnerId(window);
};

exports.getOuterId = function(window) {
  console.warn('require("window-utils").getOuterId is deprecated, ' +
               'please use require("window/utils").getOuterId instead');
  return getOuterId(window);
};

function isBrowser(window) {
  return window.document.documentElement.getAttribute("windowtype") ===
         "navigator:browser";
};
exports.isBrowser = isBrowser;

exports.hiddenWindow = appShellService.hiddenDOMWindow;

when(
  function() {
    gDocsToClose.slice().forEach(
      function(doc) { doc.defaultView.close(); });
  });
