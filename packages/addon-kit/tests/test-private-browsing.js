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
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Paul O’Shannessy <paul@oshannessy.com>
 *  Irakli Gozalishvili <gozala@mozilla.com>
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

let pb = require("private-browsing");
let {Cc,Ci} = require("chrome");

let pbService;
// Currently, only Firefox implements the private browsing service.
if (require("xul-app").is("Firefox")) {
  pbService = Cc["@mozilla.org/privatebrowsing;1"].
              getService(Ci.nsIPrivateBrowsingService);
}

if (pbService) {

  // tests that active has the same value as the private browsing service expects
  exports.testGetActive = function (test) {
    test.assertEqual(pb.enabled, false,
                     "private-browsing.enabled is correct without modifying PB service");

    pbService.privateBrowsingEnabled = true;
    test.assertEqual(pb.enabled, true,
                     "private-browsing.enabled is correct after modifying PB service");
  }


  // tests that setting active does put the browser into private browsing mode
  exports.testSetActive = function (test) {
    pb.enabled = true;
    test.assertEqual(pbService.privateBrowsingEnabled, true,
                     "private-browsing.enabled=true enables private browsing mode");
    pb.enabled = false;
    test.assertEqual(pbService.privateBrowsingEnabled, false,
                     "private-browsing.enabled=false disables private browsing mode");
  }

  exports.testEnter = function(test) {
    test.waitUntilDone();
    pb.on('enter', function onEnter() {
      test.assertEqual(
        pbService.privateBrowsingEnabled,
        true,
        'private mode is enabled when "enter" event is emitted'
      );
      test.assertEqual(
        pb.enabled,
        true,
        '`enabled` is `true` when "enter" event is emitted'
      );
      pb.removeListener('enter', onEnter);
      test.done();
    })
    pb.enabled = true;
  }

  exports.testExit = function(test) {
    test.waitUntilDone();
    pb.on('exit', function onExit() {
    test.assertEqual(
        pbService.privateBrowsingEnabled,
        false,
        'private mode is disabled when "exit" event is emitted'
      );
      test.assertEqual(
        pb.enabled,
        false,
        '`enabled` is `false` when "exit" event is emitted'
      );
      pb.removeListener('exit', onExit);
      test.done();
    })
    pb.enabled = true;
    pb.enabled = false;
  }

  exports.testBothListeners = function(test) {
    test.waitUntilDone();
    let exit = false, enter = false;
    function onExit() {
      test.assertEqual(
        false,
        exit,
        'exit callback must be called only once'
      );
      test.assertEqual(
        pbService.privateBrowsingEnabled,
        false,
        'private mode is disabled when "exit" event is emitted'
      );
      test.assertEqual(
        pb.enabled,
        false,
        '`enabled` is `false` when "exit" event is emitted'
      );
      pb.on('enter', finish);
      pb.removeListener('enter', onEnter);
      pb.removeListener('enter', onEnter2);
      pb.enable = false;
      pb.enabled = true;
      exit = true;
    }
    function onEnter() {
      test.assertEqual(
        false,
        enter,
        'exit callback must be called only once'
      );
      test.assertEqual(
        pbService.privateBrowsingEnabled,
        true,
        'private mode is enabled when "enter" event is emitted'
      );
      test.assertEqual(
        pb.enabled,
        true,
        '`enabled` is `true` when "enter" event is emitted'
      );
      pb.on('exit', onExit);
      pb.enabled = false;
      enter = true;
    }
    function onEnter2() {
      test.assertEqual(
        true,
        enter,
        'enter listener must be called already'
      );
      test.assertEqual(
        false,
        exit,
        'exit callback must not be called yet'
      );
    }
    function finish() {
      test.assertEqual(
        pbService.privateBrowsingEnabled,
        true,
        'private mode is enabled when "enter" event is emitted'
      );
      test.assertEqual(
        pb.enabled,
        true,
        '`enabled` is `true` when "enter" event is emitted'
      );
      pb.removeListener('enter', finish);
      pb.removeListener('exit', onExit);
      pb.enabled = false;
      test.assertEqual(pbService.privateBrowsingEnabled, false);
      test.assertEqual(pb.enabled, false);
      test.done();
    }
    pb.on('enter', onEnter);
    pb.on('enter', onEnter2);
    pbService.privateBrowsingEnabled = true;
  }
}
else {
  // tests for the case where private browsing doesn't exist
  exports.testNoImpl = function (test) {
    test.assertEqual(pb.enabled, false,
                     "pb.enabled returns false when private browsing isn't supported");


    // Setting pb.enabled = true shouldn't have any effect. Also, no callbacks
    // should have been called. We'll just test one callback since they are
    // under the same code path.
    let wasActivated = false;
    pb.onStart = function () {
      wasActivated = true;
    }
    pb.enabled = true;
    test.assertEqual(pb.enabled, false,
                     "pb.enabled returns false even when set to true");
    test.assertEqual(wasActivated, false,
                     "onStart callback wasn't run when PB isn't supported");
  }
}
