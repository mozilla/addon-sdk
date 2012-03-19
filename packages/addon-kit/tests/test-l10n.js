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
  test.assertEqual(_("downloadsCount", 0),
                   "0 téléchargement",
                   "PluralForm form 'one' for 0 in french");
  test.assertEqual(_("downloadsCount", 1),
                   "1 téléchargement",
                   "PluralForm form 'one' for 1 in french");
  test.assertEqual(_("downloadsCount", 2),
                   "2 téléchargements",
                   "PluralForm form 'other' for n > 1 in french");

  loader.unload();
  resetLocale();
}

exports.testEnUsLocaleName = function(test) {
  let loader = Loader(module);
  setLocale("en-US");

  let _ = loader.require("l10n").get;
  test.assertEqual(_("Not translated"), "Not translated");
  test.assertEqual(_("Translated"), "Yes");

  // Check plural forms regular matching
  test.assertEqual(_("downloadsCount", 0),
                   "0 downloads",
                   "PluralForm form 'other' for 0 in english");
  test.assertEqual(_("downloadsCount", 1),
                   "one download",
                   "PluralForm form 'one' for 1 in english");
  test.assertEqual(_("downloadsCount", 2),
                   "2 downloads",
                   "PluralForm form 'other' for n != 1 in english");

  // Check optional plural forms
  test.assertEqual(_("pluralTest", 0),
                   "optional zero form",
                   "PluralForm form 'zero' can be optionaly specified. (Isn't mandatory in english)");
  test.assertEqual(_("pluralTest", 1),
                   "fallback to other",
                   "If the specific plural form is missing, we fallback to 'other'");

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