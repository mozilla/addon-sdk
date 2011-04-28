/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com> (Original Author)
 *   Drew Willcoxon <adw@mozilla.com>
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

var unload = require("unload");

exports.testUnloading = function(test) {
  var loader = test.makeSandboxedLoader();
  var ul = loader.require("unload");
  var unloadCalled = 0;
  function unload() { unloadCalled++; }
  ul.when(unload);

  // This should be ignored, as we already registered it
  ul.when(unload);

  function unload2() { unloadCalled++; }
  ul.when(unload2);
  loader.unload();
  test.assertEqual(unloadCalled, 2,
                   "Unloader functions are called on unload.");
};

exports.testEnsure = function(test) {
  test.assertRaises(function() { unload.ensure({}); },
                    "object has no 'unload' property",
                    "passing obj with no unload prop should fail");
  test.assertRaises(function() { unload.ensure({}, "destroy"); },
                    "object has no 'destroy' property",
                    "passing obj with no custom unload prop should fail");

  var called = 0;
  var obj = {unload: function() { called++; }};

  unload.ensure(obj);
  obj.unload();
  test.assertEqual(called, 1,
                   "unload() should be called");
  obj.unload();
  test.assertEqual(called, 1,
                   "unload() should be called only once");
};

/**
 * Check that destructors are called only once with Traits.
 * - check that public API is calling the destructor and unregister it,
 * - check that composed traits with multiple ensure calls, leads to only
 * one destructor call.
 */
exports.testEnsureWithTraits = function(test) {

  let { Trait } = require("traits");
  let loader = test.makeSandboxedLoader();
  let ul = loader.require("unload");

  let called = 0;
  let composedCalled = 0;
  let composedTrait = Trait.compose({
      constructor: function () {
        // We have to give "public interface" of this trait, as we want to
        // call public `unload` method and ensure that we call it only once,
        // either when we call this public function manually or on add-on unload
        ul.ensure(this._public);
      },
      unload: function unload() {
        composedCalled++;
      }
    });
  let obj = Trait.compose(
    composedTrait.resolve({
      constructor: "_constructor",
      unload : "_unload" 
    }), {
      constructor: function constructor() {
        // Same thing applies here, we need to pass public interface
        ul.ensure(this._public);
        this._constructor();
      },
      unload: function unload() {
        called++;
        this._unload();
      }
    })();

  obj.unload();
  test.assertEqual(called, 1,
                   "unload() should be called");

  test.assertEqual(composedCalled, 1,
                   "composed object unload() should be called");

  obj.unload();
  test.assertEqual(called, 1,
                   "unload() should be called only once");
  test.assertEqual(composedCalled, 1,
                   "composed object unload() should be called only once");

  loader.unload();
  test.assertEqual(called, 1,
                   "unload() should be called only once, after addon unload");
  test.assertEqual(composedCalled, 1,
                   "composed object unload() should be called only once, " +
                   "after addon unload");
};

exports.testEnsureWithTraitsPrivate = function(test) {

  let { Trait } = require("traits");
  let loader = test.makeSandboxedLoader();
  let ul = loader.require("unload");

  let called = 0;
  let privateObj = null;
  let obj = Trait.compose({
      constructor: function constructor() {
        // This time wa don't have to give public interface,
        // as we want to call a private method:
        ul.ensure(this, "_unload");
        privateObj = this;
      },
      _unload: function unload() {
        called++;
        this._unload();
      }
    })();

  loader.unload();
  test.assertEqual(called, 1,
                   "unload() should be called");

  privateObj._unload();
  test.assertEqual(called, 1,
                   "_unload() should be called only once, after addon unload");
};

exports.testReason = function (test) {
  var reason = "Reason doesn't actually have to be anything in particular.";
  var loader = test.makeSandboxedLoader();
  var ul = loader.require("unload");
  ul.when(function (rsn) {
    test.assertEqual(rsn, reason,
                     "when() reason should be reason given to loader");
  });
  var obj = {
    unload: function (rsn) {
      test.assertEqual(rsn, reason,
                       "ensure() reason should be reason given to loader");
    }
  };
  ul.ensure(obj);
  loader.unload(reason);
};
