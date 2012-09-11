/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Cu } = require("chrome");

// If an object is not given as second argument, the JavaScript Module scope is
// returned, so we can obtain from it the `atob` and `btoa` functions
const { atob, btoa } = Cu.import("resource://gre/modules/Services.jsm");

function isUTF8(charset) {
  let type = typeof charset;

  if (type === "undefined")
    return false;

  if (type === "string" && charset.toLowerCase() === "utf-8")
    return true;

  throw new Error("The charset argument can be only 'utf-8'");
}

exports.decode = function (data, charset) {
  if (isUTF8(charset))
		return decodeURIComponent(escape(atob(data)))

	return atob(data);
}

exports.encode = function (data, charset) {
  if (isUTF8(charset))
    return btoa(unescape(encodeURIComponent(data)))

	return btoa(data);
}
