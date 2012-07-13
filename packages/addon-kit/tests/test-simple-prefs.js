/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader } = require("test-harness/loader");
const { setTimeout } = require("timers");
const { notify } = require("observer-service");
const { id } = require("self");

exports.testIterations = function(test) {
  test.waitUntilDone();

  let loader = Loader(module);
  let sp = loader.require("simple-prefs").prefs;

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

  loader.unload();
  test.done();
}

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
  notify((id + "-cmdPressed"), "", "test-btn-listen");

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

  // emit change
  sp.prefs["test-listen2"] = true;
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
