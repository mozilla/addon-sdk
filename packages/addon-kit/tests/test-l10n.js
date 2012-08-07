/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const prefs = require("preferences-service");
const { Loader } = require('test-harness/loader');
const { resolveURI } = require('api-utils/loader');
const { rootURI } = require("@loader/options");

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

function definePseudo(loader, id, exports) {
  let uri = resolveURI(id, loader.mapping);
  loader.modules[uri] = { exports: exports };
}

function createTest(locale, testFunction) {
  return function (test) {
    test.waitUntilDone();
    let loader = Loader(module);
    // Change the locale before loading new l10n modules in order to load
    // the right .json file
    setLocale(locale);
    // Initialize main l10n module in order to load new locale files
    loader.require("api-utils/l10n/loader").
      load(rootURI).
      then(function success(data) {
             definePseudo(loader, '@l10n/data', data);
             // Execute the given test function
             testFunction(test, loader, function onDone() {
               loader.unload();
               resetLocale();
               test.done();
             });
           },
           function failure(error) {
             test.fail("Unable to load locales: " + error);
           });
  };
}

exports.testExactMatching = createTest("fr-FR", function(test, loader, done) {
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

  done();
});

exports.testHtmlLocalization = createTest("en-GB", function(test, loader, done) {

  // Ensure initing html component that watch document creations
  // Note that this module is automatically initialized in
  // cuddlefish.js:Loader.main in regular addons. But it isn't for unit tests.
  let loaderHtmlL10n = loader.require("api-utils/l10n/html");
  loaderHtmlL10n.enable();

  let uri = require("self").data.url("test-localization.html");
  let worker = loader.require("page-worker").Page({
    contentURL: uri,
    contentScript: "new " + function ContentScriptScope() {
      let nodes = document.body.querySelectorAll("*[data-l10n-id]");
      self.postMessage([nodes[0].innerHTML,
                        nodes[1].innerHTML,
                        nodes[2].innerHTML,
                        nodes[3].innerHTML]);
    },
    onMessage: function (data) {
      test.assertEqual(
        data[0],
        "Kept as-is",
        "Nodes with unknown id in .properties are kept 'as-is'"
      );
      test.assertEqual(data[1], "Yes", "HTML is translated");
      test.assertEqual(
        data[2],
        "no &lt;b&gt;HTML&lt;/b&gt; injection",
        "Content from .properties is text content; HTML can't be injected."
      );
      test.assertEqual(data[3], "Yes", "Multiple elements with same data-l10n-id are accepted.");

      done();
    }
  });

});

exports.testEnUsLocaleName = createTest("en-US", function(test, loader, done) {
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

  // Ensure that we can omit specifying the generic key without [other]
  // key[one] = ...
  // key[other] = ...  # Instead of `key = ...`
  test.assertEqual(_("explicitPlural", 1),
                   "one",
                   "PluralForm form can be omitting generic key [i.e. without ...[other] at end of key)");
  test.assertEqual(_("explicitPlural", 10),
                   "other",
                   "PluralForm form can be omitting generic key [i.e. without ...[other] at end of key)");

  done();
});

exports.testShortLocaleName = createTest("eo", function(test, loader, done) {
  let _ = loader.require("l10n").get;
  test.assertEqual(_("Not translated"), "Not translated");
  test.assertEqual(_("Translated"), "jes");

  done();
});
