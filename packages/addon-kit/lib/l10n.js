/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let prefs = require("preferences-service");
let { Cc, Ci } = require("chrome");

let globalHash = {};

exports.get = function get(k) {

  // For now, we only accept a "string" as first argument
  // TODO: handle plural forms in gettext pattern
  if (typeof k !== "string")
    throw new Error("First argument of localization method should be a string");

  // Get translation from big hashmap or default to hard coded string:
  let localized = globalHash[k] || k;

  // # Simplest usecase:
  //   // String hard coded in source code:
  //   _("Hello world")
  //   // Identifier of a key stored in properties file
  //   _("helloString")
  if (arguments.length <= 1)
    return localized;

  let args = arguments;

  if (typeof localized == "object" && "other" in localized) {
    // # Plural form:
    //   // Strings hard coded in source code:
    //   _(["One download", "%d downloads"], 10);
    //   // Identifier of a key stored in properties file
    //   _("downloadNumber", 0);
    let n = arguments[1];
    let pluralForm = "other";
    // TODO: Make this rule specific to each language
    if (n <= 1)
      pluralForm = "one";
    localized = localized[pluralForm];
    // Simulate a string with one placeholder:
    args = [null, n];
  }

  // # String with placeholders:
  //   // Strings hard coded in source code:
  //   _("Hello %s", username)
  //   // Identifier of a key stored in properties file
  //   _("helloString", username)
  // * We supports `%1s`, `%2s`, ... pattern in order to change arguments order
  // in translation.
  // * In case of plural form, we has `%d` instead of `%s`.
  let offset = 1;
  localized = localized.replace(/%(\d*)(s|d)/g, function (v, n) {
      let rv = args[n != "" ? n : offset];
      offset++;
      return rv;
    });

  return localized;
}

function readURI(uri) {
  let request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                createInstance(Ci.nsIXMLHttpRequest);
  request.open('GET', uri, false);
  request.overrideMimeType('text/plain');
  request.send();
  return request.responseText;
}

// Returns URI of the best locales file to use from the XPI
//   Reproduce platform algorithm, see `LanguagesMatch` and
//   `nsChromeRegistryChrome::nsProviderArray::GetProvider` functions:
//   http://mxr.mozilla.org/mozilla-central/source/chrome/src/nsChromeRegistryChrome.cpp#93
// TODO: Implement a better matching algorithm using "intl.accept_languages"
// and following: http://tools.ietf.org/html/rfc4647#page-14
function searchAddonLocaleFile(preferred) {
  // Get URI for the addon root folder:
  let rootURI = require("@packaging").rootURI;

  // Read localization manifest file that contains list of available languages
  let localesManifest = JSON.parse(readURI(rootURI + "locales.json"));
  let locales = localesManifest.locales;

  let localeFile = null;
  // Select exact matching first
  if (locales.indexOf(preferred) != -1) {
    localeFile = preferred;
  }
  // Then ignore yy in "xx-yy" pattern.
  // Ex: accept "fr-FR", if `preferred` is "fr"
  else {
    let prefix = preferred.replace(/-.*$/, "");
    for each(let filename in locales) {
      if (filename.indexOf(prefix + "-") == 0) {
        localeFile = filename;
        break;
      }
    }
  }
  if (!localeFile)
    return null;

  return rootURI + "locale/" + localeFile + ".json";
}

function init() {
  // First, search for a locale file:
  let preferred = prefs.get("general.useragent.locale", "en-US");
  let localeURI = searchAddonLocaleFile(preferred);
  if (!localeURI)
    return;

  let manifestJSON = readURI(localeURI);
  let manifest = JSON.parse(manifestJSON);

  // Locale files only contains one big JSON object that is used as
  // an hashtable of: "key to translate" => "translated key"
  // TODO: We are likely to change this in order to be able to overload
  //       a specific key translation. For a specific package, module or line?
  globalHash = manifest;
}
init();
