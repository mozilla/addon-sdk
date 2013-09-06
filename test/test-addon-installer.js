/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci, Cu } = require("chrome");
const AddonInstaller = require("sdk/addon/installer");
const observers = require("sdk/deprecated/observer-service");
const { setTimeout } = require("sdk/timers");
const tmp = require("sdk/test/tmp-file");
const system = require("sdk/system");

const testFolderURL = module.uri.split('test-addon-installer.js')[0];
const ADDON_URL = testFolderURL + "fixtures/addon-install-unit-test@mozilla.com.xpi";
const ADDON_PATH = tmp.createFromURL(ADDON_URL);

exports["test Install"] = function (assert, done) {

  // Save all events distpatched by bootstrap.js of the installed addon
  let events = [];
  function eventsObserver(subject, data) {
    events.push(data);
  }
  observers.add("addon-install-unit-test", eventsObserver, false);

  // Install the test addon
  AddonInstaller.install(ADDON_PATH).then(
    function onInstalled(id) {
      assert.equal(id, "addon-install-unit-test@mozilla.com", "`id` is valid");

      // Now uninstall it
      AddonInstaller.uninstall(id).then(function () {
        // Ensure that bootstrap.js methods of the addon have been called
        // successfully and in the right order
        let expectedEvents = ["install", "startup", "shutdown", "uninstall"];
        assert.equal(JSON.stringify(events),
                         JSON.stringify(expectedEvents),
                         "addon's bootstrap.js functions have been called");

        observers.remove("addon-install-unit-test", eventsObserver);
        done();
      });
    },
    function onFailure(code) {
      assert.fail("Install failed: "+code);
      observers.remove("addon-install-unit-test", eventsObserver);
      done();
    }
  );
};

exports["test Failing Install With Invalid Path"] = function (assert, done) {
  AddonInstaller.install("invalid-path").then(
    function onInstalled(id) {
      assert.fail("Unexpected success");
      done();
    },
    function onFailure(code) {
      assert.equal(code, AddonInstaller.ERROR_FILE_ACCESS,
                       "Got expected error code");
      done();
    }
  );
};

exports["test Failing Install With Invalid File"] = function (assert, done) {
  let directory = system.pathFor("ProfD");
  AddonInstaller.install(directory).then(
    function onInstalled(id) {
      assert.fail("Unexpected success");
      done();
    },
    function onFailure(code) {
      assert.equal(code, AddonInstaller.ERROR_CORRUPT_FILE,
                       "Got expected error code");
      done();
    }
  );
}

exports["test Update"] = function (assert, done) {
  // Save all events distpatched by bootstrap.js of the installed addon
  let events = [];
  let iteration = 1;
  function eventsObserver(subject, data) {
    events.push(data);
  }
  observers.add("addon-install-unit-test", eventsObserver);

  function onInstalled(id) {
    let prefix = "[" + iteration + "] ";
    assert.equal(id, "addon-install-unit-test@mozilla.com",
                     prefix + "`id` is valid");

    // On 2nd and 3rd iteration, we receive uninstall events from the last
    // previously installed addon
    let expectedEvents =
      iteration == 1
      ? ["install", "startup"]
      : ["shutdown", "uninstall", "install", "startup"];
    assert.equal(JSON.stringify(events),
                     JSON.stringify(expectedEvents),
                     prefix + "addon's bootstrap.js functions have been called");

    if (iteration++ < 3) {
      next();
    }
    else {
      events = [];
      AddonInstaller.uninstall(id).then(function() {
        let expectedEvents = ["shutdown", "uninstall"];
        assert.equal(JSON.stringify(events),
                     JSON.stringify(expectedEvents),
                     prefix + "addon's bootstrap.js functions have been called");

        observers.remove("addon-install-unit-test", eventsObserver);
        done();
      });
    }
  }
  function onFailure(code) {
    assert.fail("Install failed: "+code);
    observers.remove("addon-install-unit-test", eventsObserver);
    done();
  }

  function next() {
    events = [];
    AddonInstaller.install(ADDON_PATH).then(onInstalled, onFailure);
  }

  next();
};

exports['test Uninstall failure'] = function (assert, done) {
  AddonInstaller.uninstall('invalid-addon-path').then(
    () => assert.fail('Addon uninstall should not resolve successfully'),
    () => assert.pass('Addon correctly rejected invalid uninstall')
  ).then(done, assert.fail);
};

exports['test Addon Disable'] = function (assert, done) {
  let ensureActive = (addonId) => AddonInstaller.isActive(addonId).then(state => {
    assert.equal(state, true, 'Addon should be enabled by default');
    return addonId;
  });
  let ensureInactive = (addonId) => AddonInstaller.isActive(addonId).then(state => {
    assert.equal(state, false, 'Addon should be disabled after disabling');
    return addonId;
  });

  AddonInstaller.install(ADDON_PATH)
    .then(ensureActive)
    .then(AddonInstaller.disable)
    .then(ensureInactive)
    .then(AddonInstaller.uninstall)
    .then(done, assert.fail);
};

exports['test Disable failure'] = function (assert, done) {
  AddonInstaller.disable('not-an-id').then(
    () => assert.fail('Addon disable should not resolve successfully'),
    () => assert.pass('Addon correctly rejected invalid disable')
  ).then(done, assert.fail);
};

require("test").run(exports);
