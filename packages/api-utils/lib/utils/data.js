/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci, Cu } = require("chrome");
const IOService = Cc["@mozilla.org/network/io-service;1"].
  getService(Ci.nsIIOService);
const AppShellService = Cc["@mozilla.org/appshell/appShellService;1"].
  getService(Ci.nsIAppShellService);

const { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm");
const FaviconService = Cc["@mozilla.org/browser/favicon-service;1"].
                          getService(Ci.nsIFaviconService);

const PNG_B64 = "data:image/png;base64,";
const DEF_FAVICON_URI = "chrome://mozapps/skin/places/defaultFavicon.png";
let   DEF_FAVICON = null;

/**
 * Takes URI of the page and returns associated favicon URI.
 * If page under passed uri has no favicon then base64 encoded data URI of
 * default faveicon is returned.
 * @param {String} uri
 * @returns {String}
 */
exports.getFaviconURIForLocation = function getFaviconURIForLocation(uri) {
  let pageURI = NetUtil.newURI(uri);
  try {
    return FaviconService.getFaviconDataAsDataURL(
                  FaviconService.getFaviconForPage(pageURI));
  }
  catch(e) {
    if (!DEF_FAVICON) {
      DEF_FAVICON = PNG_B64 +
                    base64Encode(getChromeURIContent(DEF_FAVICON_URI));
    }
    return DEF_FAVICON;
  }
}

/**
 * Takes chrome URI and returns content under that URI.
 * @param {String} chromeURI
 * @returns {String}
 */
function getChromeURIContent(chromeURI) {
  let channel = IOService.newChannel(chromeURI, null, null);
  let input = channel.open();
  let stream = Cc["@mozilla.org/binaryinputstream;1"].
                createInstance(Ci.nsIBinaryInputStream); 
  stream.setInputStream(input);
  let content = stream.readBytes(input.available());
  stream.close();
  input.close();
  return content;
}
exports.getChromeURIContent = getChromeURIContent;

/**
 * Creates a base-64 encoded ASCII string from a string of binary data.
 */
function base64Encode(data) AppShellService.hiddenDOMWindow.btoa(String(data));
exports.base64Encode = base64Encode;

/**
 * Decodes a string of data which has been encoded using base-64 encoding.
 */
function base64Decode(data) AppShellService.hiddenDOMWindow.atob(String(data));
exports.base64Decode = base64Decode;
