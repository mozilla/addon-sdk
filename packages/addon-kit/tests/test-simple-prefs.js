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
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Erik Vold <erikvvold@gmail.com> (Original Author)
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


const { Loader } = require("./helpers");
const setTimeout = require("timers").setTimeout;
const notify = require("observer-service").notify;
const { jetpackID } = require("@packaging");

exports.testSetGetBool = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs").prefs;

  test.assertEqual(sp.test, undefined, "Value should not exist");
  sp.test = true;
  test.assert(sp.test, "Value read should be the value previously set");

  loader.unload();
  test.done();
};

exports.testSetGetInt = function(test) {
  test.waitUntilDone();

  // Load the module once, set a value.
  let loader = Loader(module);
  let sp = loader.require("simple-prefs").prefs;

  test.assertEqual(sp["test-int"], undefined, "Value should not exist");
  sp["test-int"] = 1;
  test.assertEqual(sp["test-int"], 1, "Value read should be the value previously set");

  loader.unload();
  test.done();
};

exports.testSetComplex = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs").prefs;

  try {
    sp["test-complex"] = {test: true};
    test.fail("Complex values are not allowed");
  }
  catch (e) {
    test.pass("Complex values are not allowed");
  }

  loader.unload();
  test.done();
};

exports.testSetGetString = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs").prefs;

  test.assertEqual(sp["test-string"], undefined, "Value should not exist");
  sp["test-string"] = "test";
  test.assertEqual(sp["test-string"], "test", "Value read should be the value previously set");

  loader.unload();
  test.done();
};

exports.testHasAndRemove = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs").prefs;

  sp.test = true;
  test.assert(("test" in sp), "Value exists");
  delete sp.test;
  test.assertEqual(sp.test, undefined, "Value should be undefined");

  loader.unload();
  test.done();
  
};

exports.testPrefListener = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs");

  let listener = function(prefName) {
    test.assertEqual(prefName, "test-listen", "The prefs listener heard the right event");
    test.done();
  };

  sp.on("test-listen", listener);

  sp.prefs["test-listen"] = true;
  loader.unload();
};

exports.testBtnListener = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs");

  sp.on("test-btn-listen", function() {
    test.pass("Button press event was heard");
    test.done();
  });
  notify((jetpackID + "-cmdPressed"), "", "test-btn-listen");

  loader.unload();
};

exports.testPrefRemoveListener = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs");
  let counter = 0;

  let listener = function() {
    test.pass("The prefs listener was not removed yet");

    if (++counter > 1)
      test.fail("The prefs listener was not removed");

    sp.removeListener("test-listen2", listener);

    sp.prefs["test-listen2"] = false;

    setTimeout(function() {
      test.pass("The prefs listener was removed");
      loader.unload();
      test.done();
    }, 250);
  };

  sp.on("test-listen2", listener);

  sp.prefs["test-listen2"] = true;
};
