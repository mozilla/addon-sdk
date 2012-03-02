/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { EventEmitter } = require('./events'),
      { Trait } = require('./traits');
const { when } = require('./unload');
const errors = require("./errors");

const windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                       getService(Ci.nsIWindowWatcher);
const appShellService = Cc["@mozilla.org/appshell/appShellService;1"].
                        getService(Ci.nsIAppShellService);
const observers = require('api-utils/observer-service');


const XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

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
function getInnerId(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
                getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID;
};
exports.getInnerId = getInnerId;

/**
 * Returns the ID of the window's outer window.
 */
function getOuterId(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
                getInterface(Ci.nsIDOMWindowUtils).outerWindowID;
};
exports.getOuterId = getOuterId;

function isBrowser(window) {
  return window.document.documentElement.getAttribute("windowtype") ===
         "navigator:browser";
};
exports.isBrowser = isBrowser;

exports.hiddenWindow = appShellService.hiddenDOMWindow;

function createHiddenXULFrame() {
  return function promise(deliver) {
    let window = appShellService.hiddenDOMWindow;

    // Ensuring waiting for hidden window end of loading
    // (The hidden window is still loading on windows/thunderbird)
    if (window.document.readyState != "complete") {
      window.addEventListener("load", function onload() {
        window.removeEventListener("load", onload, false);
        // We recurse with same arguments, when the window is ready
        promise(deliver);
      }, false);
      return;
    }

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

      // See bug 725323: hiddenWindow URL is different on each mozilla product
      let prefs = Cc["@mozilla.org/preferences-service;1"].
                  getService(Ci.nsIPrefBranch);
      let hiddenWindowURL = prefs.getCharPref("browser.hiddenWindowChromeURL", "");

      frame.src = hiddenWindowURL;
      frame.setAttribute('src', hiddenWindowURL);
      frame.addEventListener('DOMContentLoaded', function onLoad(event) {
        frame.removeEventListener('DOMContentLoaded', onLoad, false);
        deliver(frame.contentWindow);
      }, false);
      document.documentElement.appendChild(frame);
    }
  }
};
exports.createHiddenXULFrame = createHiddenXULFrame;

function createRemoteBrowser(remote) {
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
exports.createRemoteBrowser = createRemoteBrowser;

/**
 * Returns `nsIXULWindow` for the given `nsIDOMWindow`.
 */
function xul(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIWebNavigation).
    QueryInterface(Ci.nsIDocShellTreeItem).
    treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIXULWindow);
};
exports.xul = xul;

/**
 * Returns `nsIBaseWindow` for the given `nsIDOMWindow`.
 */
function base(window) {
  return window.QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIWebNavigation).
    QueryInterface(Ci.nsIDocShell).
    QueryInterface(Ci.nsIDocShellTreeItem).
    treeOwner.
    QueryInterface(Ci.nsIBaseWindow);
}
exports.base = base;

/**
 * Takes hash of options and serializes it to a features string that
 * can be used passed to `window.open`. For more details on features string see:
 * https://developer.mozilla.org/en/DOM/window.open#Position_and_size_features
 */
function serializeFeatures(options) {
  return Object.keys(options).reduce(function(result, name) {
    let value = options[name]
    return result + ',' + name + '=' +
           (value === true ? 'yes' : value === false ? 'no' : value)
  }, '').substr(1)
}

/**
 * Removes given window from the application's window registry. Unless
 * `options.close` is `false` window is automatically closed on application
 * quit.
 * @params {nsIDOMWindow} window
 * @params {Boolean} options.close
 */
function backgroundify(window, options) {
  let baseWindow = base(window);
  baseWindow.visibility = false;
  baseWindow.enabled = false;
  appShellService.unregisterTopLevelWindow(xul(window));
  if (!options || options.close !== false)
    observers.add('quit-application-granted', window.close.bind(window));

  return window;
}
exports.backgroundify = backgroundify;

/**
 * Creates a top level window and returns it's `nsIWindow` representation.
 * @params {String} uri
 *    URI of the document to be loaded into window.
 * @params {nsIDOMWindow} options.parent
 *    Used as parent for the created window.
 * @params {String} options.name
 *    Optional name that is assigned to the window.
 * @params {Object} options.features
 *    Map of key, values like: `{ width: 10, height: 15, chrome: true }`.
 */
function newTopWindow(uri, options) {
  options = options || {};
  return windowWatcher.
    openWindow(options.parent || null,
               uri,
               options.name || null,
               serializeFeatures(options.features || {}),
               null);
}
exports.newTopWindow = newTopWindow;

/**
 * Creates an iframe in a provided document.
 * @params {nsIDOMDocument} document
 * @params {String} options.type
 *    By default is 'content' for possible values see:
 *    https://developer.mozilla.org/en/XUL/iframe#a-browser.type
 * @params {String} options.uri
 *    URI of the document to be loaded into created frame.
 * @params {Boolean} options.remote
 *    If `true` separate process will be used for this frame, also in such
 *    case all the following options are ignored.
 * @params {Boolean} options.allowAuth
 *    Whether to allow auth dialogs. Defaults to `false`.
 * @params {Boolean} options.allowJavascript
 *    Whether to allow Javascript execution. Defaults to `false`.
 * @params {Boolean} options.allowPlugins
 *    Whether to allow plugin execution. Defaults to `false`.
 */
function newFrame(document, options) {
  let frame, docShell, remote;
  options = options || {};
  remote = options.remote === true

  frame = document.createElementNS(XUL, 'browser');
  // Type="content" is mandatory to enable stuff here:
  // http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1776
  frame.setAttribute('type', options.type || 'content');
  frame.setAttribute('src', options.uri || 'about:blank');

  // Load in separate process if `options.remote` is `true`.
  // http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsFrameLoader.cpp#1347
  if (remote) {
    // We remove XBL binding to avoid execution of code that is not going to
    // work because browser has no docShell attribute in remote mode
    // (for example)
    frame.setAttribute('style', '-moz-binding: none;');
    frame.setAttribute('remote', 'true');
  }

  document.documentElement.appendChild(frame);

  // If browser is remote it won't have a `docShell`.
  if (!remote) {
    docShell = frame.docShell;
    docShell.allowAuth = options.allowAuth || false;
    docShell.allowJavascript = options.allowJavascript || false;
    docShell.allowPlugins = options.allowPlugins || false;
  }

  return frame;
}
exports.newFrame = newFrame;

require("./unload").when(
  function() {
    gDocsToClose.slice().forEach(
      function(doc) { doc.defaultView.close(); });
  });
