/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");
const { getPreferedLocales, findClosestLocale } = require("api-utils/l10n/locale");

// Get URI for the addon root folder:
const { rootURI } = require("@packaging");

let globalHash = {};
let bestMatchingLocale = null;

exports.get = function get(k) {
  return k in globalHash ? globalHash[k] : null;
}

// Returns the full length locale code: ja-JP-mac, en-US or fr
exports.locale = function locale() {
  return bestMatchingLocale;
}
// Returns the short locale code: ja, en, fr
exports.language = function language() {
  return bestMatchingLocale.split("-")[0].toLowerCase();
}

function readURI(uri) {
  let request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                createInstance(Ci.nsIXMLHttpRequest);
  request.open('GET', uri, false);
  request.overrideMimeType('text/plain');
  request.send();
  return request.responseText;
}

function readJsonUri(uri) {
  try {
    return JSON.parse(readURI(uri));
  }
  catch(e) {
    console.error("Error while reading locale file:\n" + uri + "\n" + e);
  }
  return {};
}

// Returns the array stored in `locales.json` manifest that list available
// locales files
function getAvailableLocales() {
  let uri = rootURI + "locales.json";
  let manifest = readJsonUri(uri);

  return "locales" in manifest &&
          Array.isArray(manifest.locales) ?
         manifest.locales : [];
}

// Returns URI of the best locales file to use from the XPI
function getBestLocaleFile() {

  // Read localization manifest file that contains list of available languages
  let availableLocales = getAvailableLocales();

  // Retrieve list of prefered locales to use
  let preferedLocales = getPreferedLocales();

  // Compute the most preferable locale to use by using these two lists
  bestMatchingLocale = findClosestLocale(availableLocales, preferedLocales);

  // It may be null if the addon doesn't have any locale file
  if (!bestMatchingLocale)
    return null;

  return rootURI + "locale/" + bestMatchingLocale + ".json";
}

function init() {
  // First, search for a locale file:
  let localeURI = getBestLocaleFile();
  if (!localeURI)
    return;

  // Locale files only contains one big JSON object that is used as
  // an hashtable of: "key to translate" => "translated key"
  // TODO: We are likely to change this in order to be able to overload
  //       a specific key translation. For a specific package, module or line?
  globalHash = readJsonUri(localeURI);
}
init();
