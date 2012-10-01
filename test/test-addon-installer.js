/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cc, Ci, Cu } = require("chrome");
const AddonInstaller = require("api-utils/addon/installer");
const observers = require("api-utils/observer-service");
const { setTimeout } = require("timer");
const tmp = require("test-harness/tmp-file");

const testFolderURL = module.uri.split('test-addon-installer.js')[0];
const ADDON_URL = testFolderURL + "fixtures/addon-install-unit-test@mozilla.com.xpi";
const ADDON_PATH = tmp.createFromURL(ADDON_URL);

exports.testInstall = function (test) {
  test.waitUntilDone();

  // Save all events distpatched by bootstrap.js of the installed addon
  let events = [];
  function eventsObserver(subject, data) {
    events.push(data);
  }
  observers.add("addon-install-unit-test", eventsObserver, false);

  // Install the test addon
  AddonInstaller.install(ADDON_PATH).then(
    function onInstalled(id) {
      test.assertEqual(id, "addon-install-unit-test@mozilla.com", "`id` is valid");

      // Now uninstall it
      AddonInstaller.uninstall(id).then(function () {
        // Ensure that bootstrap.js methods of the addon have been called
        // successfully and in the right order
        let expectedEvents = ["install", "startup", "shutdown", "uninstall"];
        test.assertEqual(JSON.stringify(events),
                         JSON.stringify(expectedEvents),
                         "addon's bootstrap.js functions have been called");

        observers.remove("addon-install-unit-test", eventsObserver);
        test.done();
      });
    },
    function onFailure(code) {
      test.fail("Install failed: "+code);
      observers.remove("addon-install-unit-test", eventsObserver);
      test.done();
    }
  );
}

exports.testFailingInstallWithInvalidPath = function (test) {
  test.waitUntilDone();

  AddonInstaller.install("invalid-path").then(
    function onInstalled(id) {
      test.fail("Unexpected success");
      test.done();
    },
    function onFailure(code) {
      test.assertEqual(code, AddonInstaller.ERROR_FILE_ACCESS,
                       "Got expected error code");
      test.done();
    }
  );
}

exports.testFailingInstallWithInvalidFile = function (test) {
  test.waitUntilDone();

  let directory = require("system").pathFor("ProfD");
  AddonInstaller.install(directory).then(
    function onInstalled(id) {
      test.fail("Unexpected success");
      test.done();
    },
    function onFailure(code) {
      test.assertEqual(code, AddonInstaller.ERROR_CORRUPT_FILE,
                       "Got expected error code");
      test.done();
    }
  );
}

exports.testUpdate = function (test) {
  test.waitUntilDone();

  // Save all events distpatched by bootstrap.js of the installed addon
  let events = [];
  let iteration = 1;
  function eventsObserver(subject, data) {
    events.push(data);
  }
  observers.add("addon-install-unit-test", eventsObserver);

  function onInstalled(id) {
    let prefix = "[" + iteration + "] ";
    test.assertEqual(id, "addon-install-unit-test@mozilla.com",
                     prefix + "`id` is valid");

    // On 2nd and 3rd iteration, we receive uninstall events from the last 
    // previously installed addon
    let expectedEvents =
      iteration == 1 
      ? ["install", "startup"]
      : ["shutdown", "uninstall", "install", "startup"];
    test.assertEqual(JSON.stringify(events),
                     JSON.stringify(expectedEvents),
                     prefix + "addon's bootstrap.js functions have been called");

    if (iteration++ < 3) {
      next();
    }
    else {
      observers.remove("addon-install-unit-test", eventsObserver);
      test.done();
    }
  }
  function onFailure(code) {
    test.fail("Install failed: "+code);
    observers.remove("addon-install-unit-test", eventsObserver);
    test.done();
  }

  function next() {
    events = [];
    AddonInstaller.install(ADDON_PATH).then(onInstalled, onFailure);
  }

  next();
}
