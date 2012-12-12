/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci } = require("chrome");
const { setTimeout } = require("../timers");
const { platform } = require("../system");
const { getMostRecentBrowserWindow: activeBrowser,
        getOwnerBrowserWindow: getBrowser,
        getHiddenWindow } = require('../window/utils');
const { find } = require("../util/array");
const { create: createFrame, swapFrameLoaders } = require("../frame/utils");
let appShellService = Cc["@mozilla.org/appshell/appShellService;1"].
                        getService(Ci.nsIAppShellService);


const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function open(panel, width, height, anchor) {
  // Wait for the XBL binding to be constructed
  if (!panel.openPopup) setTimeout(open, 50, panel, width, height, anchor);
  else display(panel, width, height, anchor);
}
exports.open = open;

function isOpen(panel) {
  return panel.state === "open"
}
exports.isOpen = isOpen;


function close(panel) {
  // Sometimes "TypeError: panel.hidePopup is not a function" is thrown
  // when quitting the host application while a panel is visible.  To suppress
  // these errors, check for "hidePopup" in panel before calling it.
  // It's not clear if there's an issue or it's expected behavior.

  return panel.hidePopup && panel.hidePopup();
}
exports.close = close


function resize(panel, width, height) {
  // Resize the iframe instead of using panel.sizeTo
  // because sizeTo doesn't work with arrow panels
  panel.firstChild.style.width = width + "px";
  panel.firstChild.style.height = height + "px";
}
exports.resize = resize

function display(panel, width, height, anchor) {
  let document = panel.ownerDocument;
  let x = null;
  let y = null;
  let position = null;

  if (!anchor) {
    // Open the popup in the middle of the window.
    x = document.documentElement.clientWidth / 2 - width / 2;
    y = document.documentElement.clientHeight / 2 - height / 2;
    position = null;
  }
  else {
    // Open the popup by the anchor.
    let rect = anchor.getBoundingClientRect();

    let window = anchor.ownerDocument.defaultView;

    let zoom = window.mozScreenPixelsPerCSSPixel;
    let screenX = rect.left + window.mozInnerScreenX * zoom;
    let screenY = rect.top + window.mozInnerScreenY * zoom;

    // Set up the vertical position of the popup relative to the anchor
    // (always display the arrow on anchor center)
    let horizontal, vertical;
    if (screenY > window.screen.availHeight / 2 + height)
      vertical = "top";
    else
      vertical = "bottom";

    if (screenY > window.screen.availWidth / 2 + width)
      horizontal = "left";
    else
      horizontal = "right";

    let verticalInverse = vertical == "top" ? "bottom" : "top";
    position = vertical + "center " + verticalInverse + horizontal;

    // Allow panel to flip itself if the panel can't be displayed at the
    // specified position (useful if we compute a bad position or if the
    // user moves the window and panel remains visible)
    panel.setAttribute("flip", "both");
  }

  // Resize the iframe instead of using panel.sizeTo
  // because sizeTo doesn't work with arrow panels
  panel.firstChild.style.width = width + "px";
  panel.firstChild.style.height = height + "px";

  panel.openPopup(anchor, position, x, y);
}
exports.display = display;

function show(panel, width, height, anchor) {
  let browser = anchor && getBrowser(anchor);
  let document = browser ? browser.document : activeBrowser().document;
  attach(panel, document);
  open(panel, width, height, anchor);
}
exports.show = show

function make(document) {
  document = document || activeBrowser().document;
  let panel = document.createElementNS(XUL_NS, "panel");
  panel.setAttribute("type", "arrow");
  attach(panel, document);

  let frame = createFrame(getHiddenWindow(), {
    allowJavascript: true,
    allowPlugins: true,
    allowAuth: true,
    // Need to override `nodeName` to use `iframe` as `browsers` save session
    // history and in consequence do not dispatch "inner-window-destroyed"
    // notifications.
    nodeName: "iframe"
  });

  frame.setAttribute("flex", 1);
  frame.setAttribute("transparent", "transparent");
  frame.setAttribute("showcaret", true);
  frame.setAttribute("clickthrough", "always");
  frame.setAttribute("autocompleteenabled", true);
  frame.setAttribute("autoscroll", true);
  if (platform === "darwin") {
    frame.style.borderRadius = "6px";
    frame.style.padding = "1px";
  }

  let browser = createFrame(panel, {
    allowJavascript: true,
    allowPlugins: true,
    allowAuth: true
  });

  browser.setAttribute("flex", 1);
  browser.setAttribute("transparent", "transparent");
  browser.setAttribute("showcaret", true);
  browser.setAttribute("clickthrough", "always");
  browser.setAttribute("autocompleteenabled", true);
  browser.setAttribute("autoscroll", true);
  if (platform === "darwin") {
    browser.style.borderRadius = "6px";
    browser.style.padding = "1px";
  }


  function onDispalyChange() { swapFrameLoaders(frame, browser); }
  function onContentLoad(event) {
    let target = event.target
    if (target === frame.contentDocument || target === browser.contentDocument)
      style(target, panel);
  }

  panel.addEventListener("popupshown", onDispalyChange, false);
  panel.addEventListener("popuphidden", onDispalyChange, false);
  frame.addEventListener("DOMContentLoaded", onContentLoad, false);
  browser.addEventListener("DOMContentLoaded", onContentLoad, false);
  panel.frame = frame;

  return panel;
}
exports.make = make;

function attach(panel, document) {
  document = document || activeBrowser().document;
  let container = document.getElementById("mainPopupSet");
  if (container !== panel.parentNode) {
    detach(panel);
    document.importNode(panel, true);
    document.getElementById("mainPopupSet").appendChild(panel);
    // Please note that `panel` needs to be part of document in order to reach
    // it's anonymous nodes. One of the anonymous node has a big padding which
    // doesn't work well since panel frame needs to fill all of the panel.
    // XBL binding is a not the best option as it's applied asynchronously, and
    // makes injected frames behave in strange way. Also this feels a lot
    // cheaper to do.
    ["panel-inner-arrowcontent", "panel-arrowcontent"].forEach(function(value) {
      let node = document.getAnonymousElementByAttribute(panel, "class", value);
      if (node) node.style.padding = 0;
    });
  }
}
exports.attach = attach;

function detach(panel) {
  if (panel.parentNode) panel.parentNode.removeChild(panel);
}
exports.detach = detach;

function dispose(panel) {
  panel.frame.parentNode.removeChild(panel.frame);
  detach(panel);
  delete panel.frame;
}
exports.dispose = dispose;

function style(document, panel) {
  /**
  Injects default OS specific panel styles into content document that is loaded
  into given panel. Optionally `document` of the browser window can be
  given to inherit styles from it, by default it will use either panel owner
  document or an active browser's document. It should not matter though unless
  Firefox decides to style windows differently base on profile or mode like
  chrome for example.
  **/

  try {
    let document = panel.ownerDocument;
    let contentDocument = panel.firstChild.contentDocument;
    let window = document.defaultView;
    let node = document.getAnonymousElementByAttribute(panel, "class",
                                                       "panel-arrowcontent") ||
               // Before bug 764755, anonymous content was different:
               // TODO: Remove this when targeting FF16+
                document.getAnonymousElementByAttribute(panel, "class",
                                                        "panel-inner-arrowcontent");

    let color = window.getComputedStyle(node).getPropertyValue("color");

    let style = contentDocument.createElement("style");
    style.id = "sdk-panel-style";
    style.textContent = "body { color: " + color + "; }";

    let container = contentDocument.head ? contentDocument.head :
                    contentDocument.documentElement;

    if (container.firstChild)
      container.insertBefore(style, container.firstChild);
    else
      container.appendChild(style);
  }
  catch (error) {
    console.error("Unable to apply panel style");
    console.exception(error);
  }
}
exports.style = style;

function getContentWindow(panel) {
  let frame = isOpen(panel) ? panel.firstChild.contentWindow :
              panel.frame;
  return frame.contentWindow;
}
exports.getContentWindow = getContentWindow;

function setURL(panel, url) {
  let frame = isOpen(panel) ? panel.firstChild :
              panel.frame;

  frame.setAttribute("src", url);
}
exports.setURL = setURL;
