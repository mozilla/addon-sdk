/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { getPreferedLocales, findClosestLocale } = require("api-utils/l10n/locale");
const prefs = require("preferences-service");
const { Cc, Ci, Cu } = require("chrome");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");
const BundleService = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);

const PREF_MATCH_OS_LOCALE  = "intl.locale.matchOS";
const PREF_SELECTED_LOCALE  = "general.useragent.locale";
const PREF_ACCEPT_LANGUAGES = "intl.accept_languages";

function assertPrefered(test, expected, msg) {
  test.assertEqual(JSON.stringify(getPreferedLocales()), JSON.stringify(expected),
                   msg);
}

exports.testGetPreferedLocales = function(test) {
  prefs.set(PREF_MATCH_OS_LOCALE, false);
  prefs.set(PREF_SELECTED_LOCALE, "");
  prefs.set(PREF_ACCEPT_LANGUAGES, "");
  assertPrefered(test, ["en-us"],
                 "When all preferences are empty, we only have en-us");

  prefs.set(PREF_SELECTED_LOCALE, "fr");
  prefs.set(PREF_ACCEPT_LANGUAGES, "jp");
  assertPrefered(test, ["fr", "jp", "en-us"],
                 "We first have useragent locale, then web one and finally en-US");

  prefs.set(PREF_SELECTED_LOCALE, "en-US");
  prefs.set(PREF_ACCEPT_LANGUAGES, "en-US");
  assertPrefered(test, ["en-us"],
                 "We do not have duplicates");

  prefs.set(PREF_SELECTED_LOCALE, "en-US");
  prefs.set(PREF_ACCEPT_LANGUAGES, "fr");
  assertPrefered(test, ["en-us", "fr"],
                 "en-US can be first if specified by higher priority preference");

  // Reset what we changed
  prefs.reset(PREF_MATCH_OS_LOCALE);
  prefs.reset(PREF_SELECTED_LOCALE);
  prefs.reset(PREF_ACCEPT_LANGUAGES);
}

// In some cases, mainly on Fennec and on Linux version,
// `general.useragent.locale` is a special 'localized' value, like:
// "chrome://global/locale/intl.properties"
exports.testPreferedLocalizedLocale = function(test) {
  prefs.set(PREF_MATCH_OS_LOCALE, false);
  let bundleURL = "chrome://global/locale/intl.properties";
  prefs.setLocalized(PREF_SELECTED_LOCALE, bundleURL);
  let contentLocale = "ja";
  prefs.set(PREF_ACCEPT_LANGUAGES, contentLocale);

  // Read manually the expected locale value from the property file
  let expectedLocale = BundleService.createBundle(bundleURL).
    GetStringFromName(PREF_SELECTED_LOCALE).
    toLowerCase();

  // First add the useragent locale
  let expectedLocaleList = [expectedLocale];

  // Then the content locale
  if (expectedLocaleList.indexOf(contentLocale) == -1)
    expectedLocaleList.push(contentLocale);

  // Add default "en-us" fallback if the main language is not already en-us
  if (expectedLocaleList.indexOf("en-us") == -1)
    expectedLocaleList.push("en-us");

  assertPrefered(test, expectedLocaleList, "test localized pref value");

  // Reset what we have changed
  prefs.reset(PREF_MATCH_OS_LOCALE);
  prefs.reset(PREF_SELECTED_LOCALE);
  prefs.reset(PREF_ACCEPT_LANGUAGES);
}

exports.testPreferedOsLocale = function(test) {
  prefs.set(PREF_MATCH_OS_LOCALE, true);
  prefs.set(PREF_SELECTED_LOCALE, "");
  prefs.set(PREF_ACCEPT_LANGUAGES, "");

  let expectedLocale = Services.locale.getLocaleComponentForUserAgent().
    toLowerCase();
  let expectedLocaleList = [expectedLocale];

  // Add default "en-us" fallback if the main language is not already en-us
  if (expectedLocale != "en-us")
    expectedLocaleList.push("en-us");

  assertPrefered(test, expectedLocaleList, "Ensure that we select OS locale when related preference is set");

  // Reset what we have changed
  prefs.reset(PREF_MATCH_OS_LOCALE);
  prefs.reset(PREF_SELECTED_LOCALE);
  prefs.reset(PREF_ACCEPT_LANGUAGES);
}

exports.testFindClosestLocale = function(test) {
  test.assertEqual(findClosestLocale([], []), null,
                   "When everything is empty we get null");

  test.assertEqual(findClosestLocale(["en-US", "en"], ["en"]),
                   "en", "We ignore more specialized locale, when there is a more generic locale");
  test.assertEqual(findClosestLocale(["ja-JP"], ["ja"]),
                   "ja-JP", "We accept more specialized locale, when there is no exact match nor more generic 1/2");
  test.assertEqual(findClosestLocale(["ja-JP-mac", "ja"], ["ja-JP"]),
                   "ja", "We accept more specialized locale, when there is no exact match nor more generic 2/2");
  test.assertEqual(findClosestLocale(["en", "en-US"], ["en-US"]),
                   "en", "We accept more generic locale first, even over exact match 1/2");
  test.assertEqual(findClosestLocale(["ja-JP-mac", "ja", "ja-JP"], ["ja-JP"]),
                   "ja", "We accept more generic locale first, even over exact match 2/2");

  test.assertEqual(findClosestLocale(["en-US", "en"], ["en"]),
                   "en", "But we accept more specialized first 1/2");
  test.assertEqual(findClosestLocale(["en", "en-US"], ["en"]),
                   "en", "But we accept more specialized first 2/2");

  test.assertEqual(findClosestLocale(["en-US"], ["en-US"]),
                   "en-US", "Case doesn't matter, but we keep the original one as result 1/3");
  test.assertEqual(findClosestLocale(["en-US"], ["en-us"]),
                   "en-US", "Case doesn't matter, but we keep the original one as result 2/3");
  test.assertEqual(findClosestLocale(["en-us"], ["en-US"]),
                   "en-us", "Case doesn't matter, but we keep the original one as result 3/3");

  test.assertEqual(findClosestLocale(["ja-JP-mac"], ["ja-JP-mac"]),
                   "ja-JP-mac", "We accept locale with 3 parts");
  test.assertEqual(findClosestLocale(["ja-JP"], ["ja-JP-mac"]),
                   "ja-JP", "We accept locale with 2 parts from locale with 3 parts");
  test.assertEqual(findClosestLocale(["ja"], ["ja-JP-mac"]),
                   "ja", "We accept locale with 1 part from locale with 3 parts");
}
