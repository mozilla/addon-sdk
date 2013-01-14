/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { Cc, Ci } = require("chrome");
const timer = require("sdk/timers");
const { LoaderWithHookedConsole, pb, pbUtils } = require("private-browsing-helper");
const windows = require("windows").browserWindows;
const { windows: windowsIterator } = require("sdk/window/utils");
const tabs = require("sdk/tabs");
const events = require("sdk/system/events");

let pbService;
// Currently, only Firefox implements the private browsing service.
if (require("sdk/system/xul-app").is("Firefox")) {
  try {
    pbService = Cc["@mozilla.org/privatebrowsing;1"].
                getService(Ci.nsIPrivateBrowsingService);
  } catch(e) { /* PrivateBrowsingService has been removed (Bug 818800) */ }
}

function activate() {
  if (pbService && !pbUtils.isWindowPBEnabled()) {
    pb.activate();
  }
  else if (pbUtils.isWindowPBEnabled()) {
    windows.open({private: true})
  }
}

function deactivate(callback) {
  if (callback)
    pb.once('stop', callback);

  if (pbService && !pbUtils.isWindowPBEnabled()) {
    pb.deactivate();
  }
  else if (pbUtils.isWindowPBEnabled()) {
    for each (let win in windowsIterator()) {
      if (pbUtils.isWindowPrivate(win)) {
        return win.close();
      }
    }
  }
}

// is global pb is enabled?
if (pbService && !pbUtils.isWindowPBEnabled()) {
  exports["test activate private mode via handler"] = function(test) {
    test.waitUntilDone();

    function onReady(tab) {
      if (tab.url == "about:robots")
        tab.close(function() activate());
    }
    function cleanup(tab) {
      if (tab.url == "about:") {
        tabs.removeListener("ready", cleanup);
        tab.close(function onClose() {
          test.done();
        });
      }
    }

    tabs.on("ready", onReady);
    pb.once("start", function onStart() {
      test.pass("private mode was activated");
      deactivate();
    });
    pb.once("stop", function onStop() {
      test.pass("private mode was deactivated");
      tabs.removeListener("ready", onReady);
      tabs.on("ready", cleanup);
    });
    tabs.once("open", function onOpen() {
      tabs.open("about:robots");
    });
    tabs.open("about:");
  };
}
// is pwpb enabled?
else if (pbUtils.isWindowPBEnabled()) {
  exports.testStartPWPB = function(test) {
    test.waitUntilDone();
    let started = false;
    let stopped = false;
    
    pb.once("start", function onStart() {
      test.assertEqual(this, pb, "`this` should be private-browsing module");
      test.assert(pbUtils.getMode(),
                  'private mode is active when "start" event is emitted');
      test.assert(pb.isActive,
                  '`isActive` is `true` when "start" event is emitted');
    });
    pb.once("stop", function() stopped = true);

    events.once("last-pb-context-exited", function() {
      test.assert(stopped, "stop event was already fired");
      test.done();
    });

    windows.open({
      private: true,
      onOpen: function(window) {
        test.assert(pbUtils.getMode(),
                    'private mode is active when "onOpen" event is emitted');
        test.assert(pb.isActive,
                    '`isActive` is `true` when "onOpen" event is emitted');
        test.assert(window.isPrivateBrowsing,
                    '`window.isPrivateBrowsing` is `true` when "start" event is emitted');

        window.close();
      }
    });
  }  

  exports.testStopPWPB = function(test) {
    test.waitUntilDone();

    let stopped = false;
    pb.on("stop", function onStop() {
      stopped = true;
      test.assertEqual(this, pb, "`this` should be private-browsing module");
      test.assertEqual(pbUtils.getMode(), false,
                       "private mode is disabled when stop event is emitted");
      test.assertEqual(pb.isActive, false,
                       "`isActive` is `false` when stop event is emitted");
      pb.removeListener("stop", onStop);
    });

    events.once("last-pb-context-exited", function() {
      test.assert(stopped, "stop event was already fired");
      test.done();
    });

    windows.open({
      private: true,
      onOpen: function(window) {
        test.assert(window.isPrivateBrowsing,
                    '`window.isPrivateBrowsing` is `true`');

        window.close(function() {
          test.assert(!pbUtils.getMode(),
                      'private mode is not active when pb window is closed');
          test.assert(!pb.isActive,
                      '`isActive` is `false` when pb window is closed');
          test.assert(window.isPrivateBrowsing,
                      '`window.isPrivateBrowsing` is `true` still');
        });
      }
    });
  };
}

// tests that isActive has the same value as the private browsing service
// expects
exports.testGetIsActive = function (test) {
  test.waitUntilDone();

  test.assertEqual(pb.isActive, false,
                   "private-browsing.isActive is correct without modifying PB service");

  pb.once("start", function() {
    test.assert(pb.isActive,
                  "private-browsing.isActive is correct after modifying PB service");
    // Switch back to normal mode.
    deactivate();
  });
  activate();

  pb.once("stop", function() {
    test.assert(!pb.isActive,
                "private-browsing.isActive is correct after modifying PB service");
    test.done();
  });
};

exports.testStart = function(test) {
  test.waitUntilDone();

  pb.on("start", function onStart() {
    test.assertEqual(this, pb, "`this` should be private-browsing module");
    test.assert(pbUtils.getMode(),
                'private mode is active when "start" event is emitted');
    test.assert(pb.isActive,
                '`isActive` is `true` when "start" event is emitted');
    pb.removeListener("start", onStart);
    deactivate(function() test.done());
  });
  activate();
};

exports.testStop = function(test) {
  test.waitUntilDone();
  pb.once("stop", function onStop() {
    test.assertEqual(this, pb, "`this` should be private-browsing module");
    test.assertEqual(pbUtils.getMode(), false,
                     "private mode is disabled when stop event is emitted");
    test.assertEqual(pb.isActive, false,
                     "`isActive` is `false` when stop event is emitted");
    test.done();
  });
  activate();
  pb.once("start", function() {
    deactivate();
  });
};

exports.testBothListeners = function(test) {
  test.waitUntilDone();
  let stop = false;
  let start = false;

  function onStop() {
    test.assertEqual(stop, false,
                     "stop callback must be called only once");
    test.assertEqual(pbUtils.getMode(), false,
                     "private mode is disabled when stop event is emitted");
    test.assertEqual(pb.isActive, false,
                     "`isActive` is `false` when stop event is emitted");

    pb.on("start", finish);
    pb.removeListener("start", onStart);
    pb.removeListener("start", onStart2);
    activate();
    stop = true;
  }

  function onStart() {
    test.assertEqual(false, start,
                     "stop callback must be called only once");
    test.assert(pbUtils.getMode(),
                "private mode is active when start event is emitted");
    test.assert(pb.isActive,
                "`isActive` is `true` when start event is emitted");

    pb.on("stop", onStop);
    deactivate();
    start = true;
  }

  function onStart2() {
    test.assert(start, "start listener must be called already");
    test.assertEqual(false, stop, "stop callback must not be called yet");
  }

  function finish() {
    test.assert(pbUtils.getMode(), true,
                "private mode is active when start event is emitted");
    test.assert(pb.isActive,
                "`isActive` is `true` when start event is emitted");

    pb.removeListener("start", finish);
    pb.removeListener("stop", onStop);

    deactivate();
    pb.once("stop", function () {
      test.assertEqual(pbUtils.getMode(), false);
      test.assertEqual(pb.isActive, false);

      test.done();
    });
  }

  pb.on("start", onStart);
  pb.on("start", onStart2);
  activate();
};

exports.testAutomaticUnload = function(test) {
  test.waitUntilDone();

  // Create another private browsing instance and unload it
  let { loader, errors } = LoaderWithHookedConsole();
  let pb2 = loader.require("sdk/private-browsing");
  let called = false;
  pb2.on("start", function onStart() {
    called = true;
    test.fail("should not be called:x");
  });
  loader.unload();

  // Then switch to private mode in order to check that the previous instance
  // is correctly destroyed
  pb.once("start", function onStart() {
    timer.setTimeout(function () {
      test.assert(!called, 
        "First private browsing instance is destroyed and inactive");
      // Must reset to normal mode, so that next test starts with it.
      deactivate(function() test.done());
    }, 0);
  });

  activate();
};

exports.testUnloadWhileActive = function(test) {
  test.waitUntilDone();

  let called = false;
  let { loader, errors } = LoaderWithHookedConsole();
  let pb2 = loader.require("sdk/private-browsing");
  let ul = loader.require("sdk/system/unload");

  let unloadHappened = false;
  ul.when(function() {
    unloadHappened = true;
    timer.setTimeout(function() {
      deactivate();
    });
  });
  pb2.once("start", function() {
    loader.unload();
  });
  pb2.once("stop", function() {
    called = true;
    test.assert(unloadHappened, "the unload event should have already occurred.");
    test.fail("stop should not have been fired");
  });
  pb.once("stop", function() {
    test.assert(!called, "stop was not called on unload")
    test.done();
  });

  activate();
};

// tests for the case where private browsing doesn't exist
exports.testDefault = function(test) {
  test.assertEqual(pb.isActive, false,
                   "pb.isActive returns false when private browsing isn't supported");
};
