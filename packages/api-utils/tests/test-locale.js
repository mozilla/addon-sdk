/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { getPreferedLocales, findClosestLocale } = require("locale");
const prefs = require("preferences-service");

const PREF_MATCH_OS_LOCALE  = "intl.locale.matchOS";
const PREF_SELECTED_LOCALE  = "general.useragent.locale";
const PREF_ACCEPT_LANGUAGES = "intl.accept_languages";

exports.testGetPreferedLocales = function(test) {
  function assertPrefered(expected, msg) {
    test.assertEqual(JSON.stringify(getPreferedLocales()), JSON.stringify(expected),
                     msg);
  }

  prefs.set(PREF_MATCH_OS_LOCALE, false);
  prefs.set(PREF_SELECTED_LOCALE, "");
  prefs.set(PREF_ACCEPT_LANGUAGES, "");
  assertPrefered(["en-us"],
                 "When all preferences are empty, we only have en-us");

  prefs.set(PREF_SELECTED_LOCALE, "fr");
  prefs.set(PREF_ACCEPT_LANGUAGES, "jp");
  assertPrefered(["fr", "jp", "en-us"],
                 "We first have useragent locale, then web one and finally en-US");

  prefs.set(PREF_SELECTED_LOCALE, "en-US");
  prefs.set(PREF_ACCEPT_LANGUAGES, "en-US");
  assertPrefered(["en-us"],
                 "We do not have duplicates");

  prefs.set(PREF_SELECTED_LOCALE, "en-US");
  prefs.set(PREF_ACCEPT_LANGUAGES, "fr");
  assertPrefered(["en-us", "fr"],
                 "en-US can be first if specified by higher priority preference");
}

exports.testFindClosestLocale = function(test) {
  test.assertEqual(findClosestLocale([], []), null,
                   "When everything is empty we get null");

  test.assertEqual(findClosestLocale(["en-US", "en"], ["en"]),
                   "en", "We ignore more specialized locale, when there is a more generic locale");
  test.assertEqual(findClosestLocale(["ja-JP"], ["ja"]),
                   "ja-JP", "We accept more specialized locale, when there is no exact match nor more generic 1/3");
  test.assertEqual(findClosestLocale(["ja-JP-mac", "ja"], ["ja-JP"]),
                   "ja", "We accept more specialized locale, when there is no exact match nor more generic 2/3");
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
