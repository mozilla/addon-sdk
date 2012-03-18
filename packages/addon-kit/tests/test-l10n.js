/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const prefs = require("preferences-service");
const { Loader } = require('./helpers');

const PREF_MATCH_OS_LOCALE  = "intl.locale.matchOS";
const PREF_SELECTED_LOCALE  = "general.useragent.locale";

function setLocale(locale) {
  prefs.set(PREF_MATCH_OS_LOCALE, false);
  prefs.set(PREF_SELECTED_LOCALE, locale);
}

function resetLocale() {
  prefs.reset(PREF_MATCH_OS_LOCALE);
  prefs.reset(PREF_SELECTED_LOCALE);
}

exports.testExactMatching = function(test) {
  let loader = Loader(module);
  setLocale("fr-FR");

  let _ = loader.require("l10n").get;
  test.assertEqual(_("Not translated"), "Not translated",
                   "Key not translated");
  test.assertEqual(_("Translated"), "Oui",
                   "Simple key translated");

  // Placeholders
  test.assertEqual(_("placeholderString", "works"), "Placeholder works",
                   "Value with placeholder");
  test.assertEqual(_("Placeholder %s", "works"), "Placeholder works",
                   "Key without value but with placeholder");
  test.assertEqual(_("Placeholders %2s %1s %s.", "working", "are", "correctly"), 
                   "Placeholders are working correctly.",
                   "Multiple placeholders");

  // Plurals
  test.assertEqual(_("downloadsCount", 1),
                   "Un téléchargement",
                   "PluralForm as value, 1st form");
  test.assertEqual(_("downloadsCount", 2),
                   "2 téléchargements",
                   "PluralForm as value, 1nd form");

  loader.unload();
  resetLocale();
}

exports.testEnUsLocaleName = function(test) {
  let loader = Loader(module);
  setLocale("en-US");

  let _ = loader.require("l10n").get;
  test.assertEqual(_("Not translated"), "Not translated");
  test.assertEqual(_("Translated"), "Yes");

  loader.unload();
  resetLocale();
}

exports.testShortLocaleName = function(test) {
  let loader = Loader(module);
  setLocale("eo");

  let _ = loader.require("l10n").get;
  test.assertEqual(_("Not translated"), "Not translated");
  test.assertEqual(_("Translated"), "jes");

  loader.unload();
  resetLocale();
}