/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const prefs = require("preferences-service");
const { Loader } = require('./helpers');

exports.testExactMatching = function(test) {
  let loader = Loader(module);

  prefs.set("general.useragent.locale", "fr-FR");
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
}

exports.testEnUsLocaleName = function(test) {
  let loader = Loader(module);

  prefs.set("general.useragent.locale", "en-US");
  let _ = loader.require("l10n").get;
  test.assertEqual(_("Not translated"), "Not translated");
  test.assertEqual(_("Translated"), "Yes");
  loader.unload();
}

exports.testShortLocaleName = function(test) {
  let loader = Loader(module);

  prefs.set("general.useragent.locale", "eo");
  let _ = loader.require("l10n").get;
  test.assertEqual(_("Not translated"), "Not translated");
  test.assertEqual(_("Translated"), "jes");
  loader.unload();
}
