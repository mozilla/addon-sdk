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
    test.assertEqual(pb.active, false,
                     "private-browsing.active is correct without modifying PB service");

    pbService.privateBrowsingEnabled = true;
    test.assert(pb.active,
                "private-browsing.active is correct after modifying PB service");
  };


  // tests that setting active does put the browser into private browsing mode
  exports.testSetActive = function (test) {
    pb.active = true;
    test.assertEqual(pbService.privateBrowsingEnabled, true,
                     "private-browsing.active=true enables private browsing mode");

    pb.active = false;
    test.assertEqual(pbService.privateBrowsingEnabled, false,
                     "private-browsing.active=false disables private browsing mode");
  };

  exports.testStart = function(test) {
    test.waitUntilDone();
    pb.on("start", function onStart() {
      test.assert(pbService.privateBrowsingEnabled,
                  "private mode is active when \"start\" event is emitted");
      test.assert(pb.active,
                  "`active` is `true` when \"start\" event is emitted");
      pb.removeListener("start", onStart);
      test.done();
    });
    pb.active = true;
  };

  exports.testStop = function(test) {
    test.waitUntilDone();
    pb.on("stop", function onStop() {
      test.assertEqual(pbService.privateBrowsingEnabled, false,
                       "private mode is disabled when stop event is emitted");
      test.assertEqual(pb.active, false,
                       "`active` is `false` when stop event is emitted");
      pb.removeListener("stop", onStop);
      test.done();
    });
    pb.active = true;
    pb.active = false;
  };

  exports.testBothListeners = function(test) {
    test.waitUntilDone();
    let stop = false;
    let start = false;

    function onStop() {
      test.assertEqual(stop, false,
                       "stop callback must be called only once");
      test.assertEqual(pbService.privateBrowsingEnabled, false,
                       "private mode is disabled when stop event is emitted");
      test.assertEqual(pb.active, false,
                       "`active` is `false` when stop event is emitted");

      pb.on("start", finish);
      pb.removeListener("start", onStart);
      pb.removeListener("start", onStart2);
      pb.enable = false;
      pb.active = true;
      stop = true;
    }

    function onStart() {
      test.assertEqual(false, start,
                       "stop callback must be called only once");
      test.assert(pbService.privateBrowsingEnabled,
                  "private mode is active when start event is emitted");
      test.assert(pb.active,
                  "`active` is `true` when start event is emitted");

      pb.on("stop", onStop);
      pb.active = false;
      start = true;
    }

    function onStart2() {
      test.assert(start, "start listener must be called already");
      test.assertEqual(false, stop, "stop callback must not be called yet");
    }

    function finish() {
      test.assert(pbService.privateBrowsingEnabled, true,
                  "private mode is active when start event is emitted");
      test.assert(pb.active,
                  "`active` is `true` when start event is emitted");

      pb.removeListener("start", finish);
      pb.removeListener("stop", onStop);

      pb.active = false;

      test.assertEqual(pbService.privateBrowsingEnabled, false);
      test.assertEqual(pb.active, false);

      test.done();
    }

    pb.on("start", onStart);
    pb.on("start", onStart2);
    pbService.privateBrowsingEnabled = true;
  };
}
else {
  // tests for the case where private browsing doesn't exist
  exports.testNoImpl = function (test) {
    test.assertEqual(pb.active, false,
                     "pb.active returns false when private browsing isn't supported");
  };
}
