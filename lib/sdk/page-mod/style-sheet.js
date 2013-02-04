/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

let { Cc, Ci } = require('chrome');
let { newURI } = Cc['@mozilla.org/network/io-service;1'].
                   getService(Ci.nsIIOService);

let { USER_SHEET, sheetRegistered,
        loadAndRegisterSheet, unregisterSheet
      } = Cc["@mozilla.org/content/style-sheet-service;1"].
          getService(Ci.nsIStyleSheetService);


function URI(spec) {
  return newURI(spec, null, null);
}

function isRegistered(spec) {
  return sheetRegistered(URI(spec), USER_SHEET);
}
exports.isRegistered = isRegistered;

function unregister(spec) {
  if (spec) {
    let uri = URI(spec);
    if (sheetRegistered(uri, USER_SHEET))
      unregisterSheet(uri, USER_SHEET);
  }
}
exports.unregister = unregister

function register(spec) {
  if (spec) {
    let uri = URI(spec)
    if (!sheetRegistered(uri, USER_SHEET))
      loadAndRegisterSheet(uri, USER_SHEET);
  }
}
exports.register = register

function make(patterns, styleRules) {
  let documentRules = [];

  for each (let pattern in patterns) {

    if (!pattern)
      continue;

    if (pattern.regexp)
      documentRules.push("regexp(\"" + pattern.regexp.source + "\")");
    else if (pattern.exactURL)
      documentRules.push("url(" + pattern.exactURL + ")");
    else if (pattern.domain)
      documentRules.push("domain(" + pattern.domain + ")");
    else if (pattern.urlPrefix)
      documentRules.push("url-prefix(" + pattern.urlPrefix + ")");
    else if (pattern.anyWebPage) {
      documentRules.push("regexp(\"^(https?|ftp)://.*?\")");
      break;
    }
  }

  let uri = "data:text/css;charset=utf-8,";
  if (documentRules.length > 0)
    uri += encodeURIComponent("@-moz-document " +
      documentRules.join(",") + " {" + styleRules + "}");
  else
    uri += encodeURIComponent(styleRules);

  return uri;
}
exports.make = make;
