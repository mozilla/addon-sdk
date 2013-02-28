/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const windowUtils = require('sdk/deprecated/window-utils');
const { Cc, Ci } = require('chrome');
const { isWindowPrivate, isWindowPBSupported } = require('sdk/private-browsing/utils');
const { getFrames, getWindowTitle, onFocus } = require('sdk/window/utils');
const { open, close, focus } = require('sdk/window/helpers');
const WM = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
const { isPrivate } = require('sdk/private-browsing');
const { toArray } = require('sdk/util/iterator');

function makeEmptyBrowserWindow(options) {
  options = options || {};
  return open('chrome://browser/content/browser.xul', {
    features: {
      chrome: true,
      private: !!options.private
    }
  });
}

exports.testWindowTrackerIgnoresPrivateWindows = function(assert, done) {
  var myNonPrivateWindow, myPrivateWindow;
  var finished = false;
  var privateWindow;
  var privateWindowClosed = false;

  let wt = windowUtils.WindowTracker({
    onTrack: function(window) {
      if (isWindowPrivate(window)) {
        assert.fail('private window was tracked!');
      }
    },
    onUntrack: function(window) {
      if (isWindowPrivate(window)) {
        assert.fail('private window was tracked!');
      }
      // PWPB case
      if (window === myPrivateWindow && isWindowPBSupported) {
        privateWindowClosed = true;
      }
      if (window === myNonPrivateWindow) {
        assert.ok(!privateWindowClosed);
        wt.unload();
        done();
      }
    }
  });

  // make a new private window
  makeEmptyBrowserWindow({
    private: true
  }).then(function(window) {
    myPrivateWindow = window;

    assert.equal(isWindowPrivate(window), isWindowPBSupported);
    assert.ok(getFrames(window).length > 1, 'there are frames for private window');
    assert.equal(getWindowTitle(window), window.document.title,
                 'getWindowTitle works');

    close(window).then(function() {
      makeEmptyBrowserWindow().then(function(window) {
        myNonPrivateWindow = window;
        assert.pass('opened new window');
        window.close();
      });
    });
  });
};

// Test setting activeWIndow and onFocus for private windows
exports.testSettingActiveWindowIgnoresPrivateWindow = function(assert, done) {
  let browserWindow = WM.getMostRecentWindow("navigator:browser");
  let testSteps;

  assert.equal(windowUtils.activeBrowserWindow, browserWindow,
               "Browser window is the active browser window.");

  // make a new private window
  makeEmptyBrowserWindow({
    private: true
  }).then(function(window) {
    let continueAfterFocus = function(window) onFocus(window).then(nextTest);

    // PWPB case
    if (isWindowPBSupported) {
      assert.ok(isPrivate(window), "window is private");
      assert.notDeepEqual(windowUtils.activeBrowserWindow, browserWindow);
    }
    // Global case
    else {
      assert.ok(!isPrivate(window), "window is not private");
    }

    assert.deepEqual(windowUtils.activeBrowserWindow, window,
                 "Correct active browser window pb supported");

    testSteps = [
      function() {
        continueAfterFocus(windowUtils.activeWindow = browserWindow);
      },
      function() {
          assert.deepEqual(windowUtils.activeWindow, window,
                           "Correct active window [1]");

        focus(window).then(nextTest);
      },
      function() {
        assert.deepEqual(windowUtils.activeBrowserWindow, window,
                         "Correct active browser window [2]");
        assert.deepEqual(windowUtils.activeWindow, window,
                         "Correct active window [2]");

        windowUtils.activeWindow = window;
        onFocus(window).then(nextTest);
      },
      function() {
        assert.deepEqual(windowUtils.activeBrowserWindow, window,
                         "Correct active browser window [3]");
        assert.deepEqual(windowUtils.activeWindow, window,
                         "Correct active window [3]");

        continueAfterFocus(windowUtils.activeWindow = browserWindow);
      },
      function() {
        assert.deepEqual(windowUtils.activeBrowserWindow, browserWindow,
                         "Correct active browser window when pb mode is supported [4]");
        assert.deepEqual(windowUtils.activeWindow, browserWindow,
                         "Correct active window when pb mode is supported [4]");
        close(window).then(done);
      }
    ];
    function nextTest() {
      if (testSteps.length)
        testSteps.shift()();
    }
    nextTest();
  });
};

exports.testActiveWindowIgnoresPrivateWindow = function(assert, done) {
  // make a new private window
  makeEmptyBrowserWindow({
    private: true
  }).then(function(window) {
    // PWPB case
    if (isWindowPBSupported) {
      assert.equal(isPrivate(windowUtils.activeWindow), true,
                   "active window is private");
      assert.equal(isPrivate(windowUtils.activeBrowserWindow), true,
                   "active browser window is private");
      assert.ok(isWindowPrivate(window), "window is private");
      assert.ok(isPrivate(window), "window is private");

      // pb mode is supported
      assert.ok(
        isWindowPrivate(windowUtils.activeWindow),
        "active window is private when pb mode is supported");
      assert.ok(
        isWindowPrivate(windowUtils.activeBrowserWindow),
        "active browser window is private when pb mode is supported");
      assert.ok(isPrivate(windowUtils.activeWindow),
                "active window is private when pb mode is supported");
      assert.ok(isPrivate(windowUtils.activeBrowserWindow),
        "active browser window is private when pb mode is supported");
    }
    // Global case
    else {
      assert.equal(isPrivate(windowUtils.activeWindow), false,
                   "active window is not private");
      assert.equal(isPrivate(windowUtils.activeBrowserWindow), false,
                   "active browser window is not private");
      assert.equal(isWindowPrivate(window), false, "window is not private");
      assert.equal(isPrivate(window), false, "window is not private");
    }

    close(window).then(done);
  });
}

exports.testWindowIteratorIgnoresPrivateWindows = function(assert, done) {
  // make a new private window
  makeEmptyBrowserWindow({
    private: true
  }).then(function(window) {
    // PWPB case
    if (isWindowPBSupported) {
      assert.ok(isWindowPrivate(window), "window is private");
      assert.equal(toArray(windowUtils.windowIterator()).indexOf(window), -1,
                   "window is not in windowIterator()");
    }
    // Global case
    else {
      assert.equal(isWindowPrivate(window), false, "window is not private");
      assert.ok(toArray(windowUtils.windowIterator()).indexOf(window) > -1,
                "window is in windowIterator()"); 
    }

    close(window).then(done);
  });
};

if (require("sdk/system/xul-app").is("Fennec")) {
  module.exports = {
    "test Unsupported Test": function UnsupportedTest (assert) {
        assert.pass(
          "Skipping this test until Fennec support is implemented." +
          "See bug 809412");
    }
  }
}

require("test").run(exports);
