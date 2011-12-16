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
 * The Original Code is Preferences.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *   Myk Melez <myk@mozilla.org>
 *   Erik Vold <erikvvold@gmail.com>
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

let Prefs = prefs = require("preferences-service").Prefs;
var {Cc,Ci} = require("chrome");

exports.testReset = function(test) {
  prefs.reset("test_reset_pref");
  test.assertEqual(prefs.has("test_reset_pref"), false);
  test.assertEqual(prefs.isSet("test_reset_pref"), false);
  prefs.set("test_reset_pref", 5);
  test.assertEqual(prefs.has("test_reset_pref"), true);
  test.assertEqual(prefs.isSet("test_reset_pref"), true);
  test.assertEqual(prefs.getChildList("test_reset_pref").toString(), "test_reset_pref");
};

exports.testGetAndSet = function(test) {
  let svc = Cc["@mozilla.org/preferences-service;1"].
            getService(Ci.nsIPrefService).
            getBranch(null);
  svc.setCharPref("test_set_get_pref", "a normal string");
  test.assertEqual(prefs.get("test_set_get_pref"), "a normal string",
                   "preferences-service should read from " +
                   "application-wide preferences service");

  prefs.set("test_set_get_pref.integer", 1);
  test.assertEqual(prefs.get("test_set_get_pref.integer"), 1,
                   "set/get integer preference should work");

  test.assertEqual(
      prefs.getChildList("test_set_get_pref").toString(),
      "test_set_get_pref.integer,test_set_get_pref");

  prefs.set("test_set_get_number_pref", 42);
  test.assertRaises(
    function() { prefs.set("test_set_get_number_pref", 3.14159); },
    "cannot store non-integer number: 3.14159",
    "setting a float preference should raise an error"
  );
  test.assertEqual(prefs.get("test_set_get_number_pref"), 42,
                   "bad-type write attempt should not overwrite");

  // 0x80000000 (no), 0x7fffffff (yes), -0x80000000 (yes), -0x80000001 (no)
  test.assertRaises(
    function() { prefs.set("test_set_get_number_pref", Math.pow(2, 31)); },
    ("you cannot set the test_set_get_number_pref pref to the number " +
     "2147483648, as number pref values must be in the signed 32-bit " +
     "integer range -(2^31) to 2^31-1.  To store numbers outside that " +
     "range, store them as strings."),
    "setting an int pref outside the range -(2^31) to 2^31-1 shouldn't work"
  );
  test.assertEqual(prefs.get("test_set_get_number_pref"), 42,
                   "out-of-range write attempt should not overwrite 1");
  prefs.set("test_set_get_number_pref", Math.pow(2, 31)-1);
  test.assertEqual(prefs.get("test_set_get_number_pref"), 0x7fffffff,
                   "in-range write attempt should work 1");
  prefs.set("test_set_get_number_pref", -Math.pow(2, 31));
  test.assertEqual(prefs.get("test_set_get_number_pref"), -0x80000000,
                   "in-range write attempt should work 2");
  test.assertRaises(
    function() { prefs.set("test_set_get_number_pref", -0x80000001); },
    ("you cannot set the test_set_get_number_pref pref to the number " +
     "-2147483649, as number pref values must be in the signed 32-bit " +
     "integer range -(2^31) to 2^31-1.  To store numbers outside that " +
     "range, store them as strings."),
    "setting an int pref outside the range -(2^31) to 2^31-1 shouldn't work"
  );
  test.assertEqual(prefs.get("test_set_get_number_pref"), -0x80000000,
                   "out-of-range write attempt should not overwrite 2");


  prefs.set("test_set_get_pref.string", "foo");
  test.assertEqual(prefs.get("test_set_get_pref.string"), "foo",
                   "set/get string preference should work");

  prefs.set("test_set_get_pref.boolean", true);
  test.assertEqual(prefs.get("test_set_get_pref.boolean"), true,
                   "set/get boolean preference should work");

  prefs.set("test_set_get_unicode_pref", String.fromCharCode(960));
  test.assertEqual(prefs.get("test_set_get_unicode_pref"),
                   String.fromCharCode(960),
                   "set/get unicode preference should work");

  var unsupportedValues = [null, [], undefined];
  unsupportedValues.forEach(
    function(value) {
      test.assertRaises(
        function() { prefs.set("test_set_pref", value); },
        ("can't set pref test_set_pref to value '" + value + "'; " +
         "it isn't a string, integer, or boolean"),
        "Setting a pref to " + uneval(value) + " should raise error"
      );
    });
};

exports.testPrefClass = function(test) {
  var branch = Prefs("test_foo");
  test.asset(branch instanceof Prefs, "Prefs instance is a instanceof Prefs");
  test.assetEqual(branch.test, undefined, "test_foo.test is undefined");
  branch.test = true;
  test.assetEqual(branch.test, true, "test_foo.test is true");
  delete branch.test;
  test.assetEqual(branch.test, undefined, "test_foo.test is undefined");
}
