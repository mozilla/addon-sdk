/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Loader } = require("test-harness/loader");
const { setTimeout } = require("timers");
const { notify } = require("observer-service");
const { id } = require("self");
const simplePrefs = require("simple-prefs");
const { prefs: sp } = simplePrefs;

const specialChars = "!@#$%^&*()_-=+[]{}~`\'\"<>,./?;:";

exports.testIterations = function(test) {
  sp["test"] = true;
  sp["test.test"] = true;
  let prefAry = [];
  for (var name in sp ) {
    prefAry.push(name);
  }
  test.assert("test" in sp);
  test.assert(!sp.getPropertyDescriptor);
  test.assert(Object.prototype.hasOwnProperty.call(sp, "test"));
  test.assertEqual(["test", "test.test"].toString(), prefAry.sort().toString(), "for (x in y) part 1/2 works");
  test.assertEqual(["test", "test.test"].toString(), Object.keys(sp).sort().toString(), "Object.keys works");

  delete sp["test"];
  delete sp["test.test"];
  let prefAry = [];
  for (var name in sp ) {
    prefAry.push(name);
  }
  test.assertEqual([].toString(), prefAry.toString(), "for (x in y) part 2/2 works");
}

exports.testSetGetBool = function(test) {
  test.assertEqual(sp.test, undefined, "Value should not exist");
  sp.test = true;
  test.assert(sp.test, "Value read should be the value previously set");
};

// TEST: setting and getting preferences with special characters work
exports.testSpecialChars = function(test) {
  let chars = specialChars.split("");
  let len = chars.length;

  let count = 0;
  chars.forEach(function(char) {
    let rand = Math.random() + "";
    simplePrefs.on(char, function onPrefChanged() {
      simplePrefs.removeListener(char, onPrefChanged);
      test.assertEqual(sp[char], rand, "setting pref with a name that is a special char, " + char + ", worked!");

      // end test
      if (++count == len)
        test.done();
    })
    sp[char] = rand;
  });
};

exports.testSetGetInt = function(test) {
  test.assertEqual(sp["test-int"], undefined, "Value should not exist");
  sp["test-int"] = 1;
  test.assertEqual(sp["test-int"], 1, "Value read should be the value previously set");
};

exports.testSetComplex = function(test) {
  try {
    sp["test-complex"] = {test: true};
    test.fail("Complex values are not allowed");
  }
  catch (e) {
    test.pass("Complex values are not allowed");
  }
};

exports.testSetGetString = function(test) {
  test.assertEqual(sp["test-string"], undefined, "Value should not exist");
  sp["test-string"] = "test";
  test.assertEqual(sp["test-string"], "test", "Value read should be the value previously set");
};

exports.testHasAndRemove = function(test) {
  sp.test = true;
  test.assert(("test" in sp), "Value exists");
  delete sp.test;
  test.assertEqual(sp.test, undefined, "Value should be undefined");
};

exports.testPrefListener = function(test) {
  test.waitUntilDone();

  let listener = function(prefName) {
    simplePrefs.removeListener('test-listener', listener);
    test.assertEqual(prefName, "test-listen", "The prefs listener heard the right event");
    test.done();
  };

  simplePrefs.on("test-listen", listener);

  sp["test-listen"] = true;
};

exports.testBtnListener = function(test) {
  test.waitUntilDone();

  let name = "test-btn-listen";
  simplePrefs.on(name, function listener() {
    simplePrefs.removeListener(name, listener);
    test.pass("Button press event was heard");
    test.done();
  });
  notify((id + "-cmdPressed"), "", name);
};

exports.testPrefRemoveListener = function(test) {
  test.waitUntilDone();

  let counter = 0;

  let listener = function() {
    test.pass("The prefs listener was not removed yet");

    if (++counter > 1)
      test.fail("The prefs listener was not removed");

    simplePrefs.removeListener("test-listen2", listener);

    sp["test-listen2"] = false;

    setTimeout(function() {
      test.pass("The prefs listener was removed");
      test.done();
    }, 250);
  };

  simplePrefs.on("test-listen2", listener);

  // emit change
  sp["test-listen2"] = true;
};

// Bug 710117: Test that simple-pref listeners are removed on unload
exports.testPrefUnloadListener = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs");
  let counter = 0;

  let listener = function() {
    test.assertEqual(++counter, 1, "This listener should only be called once");

    loader.unload();

    // this may not execute after unload, but definitely shouldn't fire listener
    sp.prefs["test-listen3"] = false;
    // this should execute, but also definitely shouldn't fire listener
    require("simple-prefs").prefs["test-listen3"] = false; // 

    test.done();
  };

  sp.on("test-listen3", listener);

  // emit change
  sp.prefs["test-listen3"] = true;
};

// Bug 732919 - JSON.stringify() fails on simple-prefs.prefs
exports.testPrefJSONStringification = function(test) {
  var sp = require("simple-prefs").prefs;
  test.assertEqual(
      Object.keys(sp).join(),
      Object.keys(JSON.parse(JSON.stringify(sp))).join(),
      "JSON stringification should work.");
};
