/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci, Cu } = require("chrome");
const base64 = require("../base64");
const IOService = Cc["@mozilla.org/network/io-service;1"].
  getService(Ci.nsIIOService);

const { deprecateFunction } = require('../util/deprecate');
const { Services } = Cu.import("resource://gre/modules/Services.jsm");

 * Takes chrome URI and returns content under that URI.
 * @param {String} chromeURI
 * @returns {String}
 */
function getChromeURIContent(chromeURI) {
  let channel = IOService.newChannel2(chromeURI,
                                      null,
                                      null,
                                      null,      // aLoadingNode
                                      Services.scriptSecurityManager.getSystemPrincipal(),
                                      null,      // aTriggeringPrincipal
                                      Ci.nsILoadInfo.SEC_NORMAL,
                                      Ci.nsIContentPolicy.TYPE_OTHER);
  let input = channel.open();
  let stream = Cc["@mozilla.org/binaryinputstream;1"].
                createInstance(Ci.nsIBinaryInputStream);
  stream.setInputStream(input);
  let content = stream.readBytes(input.available());
  stream.close();
  input.close();
  return content;
}
exports.getChromeURIContent = deprecateFunction(getChromeURIContent,
  'getChromeURIContent is deprecated, ' +
  'please use require("sdk/net/url").readURI instead.'
);

/**
 * Creates a base-64 encoded ASCII string from a string of binary data.
 */
exports.base64Encode = deprecateFunction(base64.encode,
  'base64Encode is deprecated, ' +
  'please use require("sdk/base64").encode instead.'
);
/**
 * Decodes a string of data which has been encoded using base-64 encoding.
 */
exports.base64Decode = deprecateFunction(base64.decode,
  'base64Dencode is deprecated, ' +
  'please use require("sdk/base64").decode instead.'
);
