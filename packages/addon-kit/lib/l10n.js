/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alexandre Poirot <apoirot@mozilla.com> (Original author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
"use strict";

let prefs = require("preferences-service");
let file = require("file");
let {components, Cc, Ci, Cu} = require("chrome");

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

// Returns path of the best locales file to use from the XPI
//   Reproduce platform algorithm, see `LanguagesMatch` and
//   `nsChromeRegistryChrome::nsProviderArray::GetProvider` functions:
//   http://mxr.mozilla.org/mozilla-central/source/chrome/src/nsChromeRegistryChrome.cpp#93
// TODO: Implement a better matching algorithm using "intl.accept_languages"
// and following: http://tools.ietf.org/html/rfc4647#page-14
function searchAddonLocaleFile(preferred) {
  // Locale files are stored in `locales` folder in XPI root folder:
  let localesPath = file.join(require("@packaging").root, "locale");
  let locales = file.list(localesPath);
  let localeFile = null;
  // Select exact matching first
  if (locales.indexOf(preferred + ".json") != -1) {
    localeFile = preferred + ".json";
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

  return file.join(localesPath, localeFile);
}

function init() {
  // First, search for a locale file:
  let preferred = prefs.get("general.useragent.locale", "en-US");
  let localePath = searchAddonLocaleFile(preferred);
  if (!localePath)
    return;

  let manifestJSON = file.read(localePath);
  let manifest = JSON.parse(manifestJSON);

  // Locale files only contains one big JSON object that is used as
  // an hashtable of: "key to translate" => "translated key"
  // TODO: We are likely to change this in order to be able to overload
  //       a specific key translation. For a specific package, module or line?
  globalHash = manifest;
}
init();
