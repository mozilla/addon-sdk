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
