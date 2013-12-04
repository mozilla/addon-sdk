/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Ci, Cc, Cr } = require("chrome");
const { defer } = require("../core/promise");
const { when: unload } = require("../system/unload");
const { baseURI } = require('@loader/options');
const addonPrincipal = Cc["@mozilla.org/systemprincipal;1"].
                     createInstance(Ci.nsIPrincipal);

const browser = Cc["@mozilla.org/appshell/appShellService;1"].
                  getService(Ci.nsIAppShellService).
                  createWindowlessBrowser(true);

const docShell = browser.
                   QueryInterface(Ci.nsIInterfaceRequestor).
                   getInterface(Ci.nsIDocShell);

const webProgress = browser.
                      QueryInterface(Ci.nsIInterfaceRequestor).
                      getInterface(Ci.nsIWebProgress);

// We need to grant docShell system principals in order to load XUL document
// from data URI into it.
docShell.createAboutBlankContentViewer(addonPrincipal);

const uri = [
  "data:application/vnd.mozilla.xul+xml;",
  "charset=utf-8,",
  "<?xml version='1.0'?>",
  "<window",
  "xmlns:html='http://www.w3.org/1999/xhtml'",
  "xmlns='http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'",
  ">",
  "<html:base xmlns='http://www.w3.org/1999/xhtml' html:href='" + baseURI + "'/>",
  "</window>"
].join(" ");

// Get a reference to the DOM window of the given docShell and load
// such document into that would allow us to create XUL iframes, that
// are necessary for hidden frames etc..
const window = docShell.contentViewer.DOMDocument.defaultView;
window.location = uri;

//const eventTarget = docShell.chromeEventHandler;
// Create a promise that is delivered once add-on window is interactive,
// used by add-on runner to defer add-on loading until window is ready.
const { promise, resolve } = defer();

const progressListener = {
  QueryInterface: iid => {
    if (iid.equals(Ci.nsIWebProgressListener) ||
        iid.equals(Ci.nsISupportsWeakReference))
       return this;
    throw Cr.NS_ERROR_NO_INTERFACE;
  },
  onStateChange: () => {
    if (window.document.readyState === "interactive" ||
        window.document.readyState === "complete") {
      webProgress.removeProgressListener(progressListener);

      // For whatever reason using `html:base` in just document does
      // not works, but doing it manually here seems to.
      const document = window.document;
      const base = document.createElementNS("http://www.w3.org/1999/xhtml", "base");
      base.setAttribute("href", baseURI);
      document.documentElement.appendChild(base);
      resolve();
    }
  }
};
webProgress.addProgressListener(progressListener,
                                Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);

exports.ready = promise;
exports.window = window;

// Still close window on unload to claim memory back early.
unload(() => { docShell.contentViewer.destroy() });
