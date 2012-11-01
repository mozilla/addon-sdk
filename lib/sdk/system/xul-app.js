/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const {Cc, Ci} = require("chrome");

var appInfo = Cc["@mozilla.org/xre/app-info;1"]
              .getService(Ci.nsIXULAppInfo);

var ID = exports.ID = appInfo.ID;
var name = exports.name = appInfo.name;
var version = exports.version = appInfo.version;
var platformVersion = exports.platformVersion = appInfo.platformVersion;

// The following mapping of application names to GUIDs was taken from:
//
//   https://addons.mozilla.org/en-US/firefox/pages/appversions
//
// Using the GUID instead of the app's name is preferable because sometimes
// re-branded versions of a product have different names: for instance,
// Firefox, Minefield, Iceweasel, and Shiretoko all have the same
// GUID.
// This mapping is duplicated in `app-extensions/bootstrap.js`. They should keep
// in sync, so if you change one, change the other too!

var ids = exports.ids = {
  Firefox: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
  Mozilla: "{86c18b42-e466-45a9-ae7a-9b95ba6f5640}",
  Sunbird: "{718e30fb-e89b-41dd-9da7-e25a45638b28}",
  SeaMonkey: "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}",
  Fennec: "{aa3c5121-dab2-40e2-81ca-7ea25febc110}",
  Thunderbird: "{3550f703-e582-4d05-9a08-453d09bdfdc6}"
};

var is = exports.is = function is(name) {
  if (!(name in ids))
    throw new Error("Unkown Mozilla Application: " + name);
  return ID == ids[name];
};

var isOneOf = exports.isOneOf = function isOneOf(names) {
  for (var i = 0; i < names.length; i++)
    if (is(names[i]))
      return true;
  return false;
};

/**
 * Use this to check whether the given version (e.g. xulApp.platformVersion)
 * is in the given range. Versions must be in version comparator-compatible
 * format. See MDC for details:
 * https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIVersionComparator
 */
var versionInRange = exports.versionInRange =
function versionInRange(version, lowInclusive, highExclusive) {
  var vc = Cc["@mozilla.org/xpcom/version-comparator;1"]
           .getService(Ci.nsIVersionComparator);
  return (vc.compare(version, lowInclusive) >= 0) &&
         (vc.compare(version, highExclusive) < 0);
}

