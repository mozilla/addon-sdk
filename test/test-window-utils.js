/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var windowUtils = require("sdk/deprecated/window-utils");
var timer = require("sdk/timers");
var { Cc, Ci } = require("chrome");
var { Loader, unload } = require("sdk/test/loader");
const { loader: pbLoader, getOwnerWindow, pbUtils, pb } = require('./private-browsing/helper');
const { open, close } = pbLoader.require('sdk/window/utils');
const { getFrames, getWindowTitle, onFocus } = require('sdk/window/utils');
const { isPrivate } = require('sdk/private-browsing');

function toArray(iterator) {
  let array = [];
  for each (let item in iterator)
    array.push(item);
  return array;
}

function makeEmptyWindow(options) {
  options = options || {};
  var xulNs = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  var blankXul = ('<?xml version="1.0"?>' +
                  '<?xml-stylesheet href="chrome://global/skin/" ' +
                  '                 type="text/css"?>' +
                  '<window xmlns="' + xulNs + '" windowtype="test:window">' +
                  '</window>');

  return open("data:application/vnd.mozilla.xul+xml;charset=utf-8," + escape(blankXul), {
    features: {
      chrome: true,
      width: 10,
      height: 10,
      private: !!options.private
    }
  });
}

exports['test close on unload'] = function(assert) {
  var timesClosed = 0;
  var fakeWindow = {
    _listeners: [],
    addEventListener: function(name, func, bool) {
      this._listeners.push(func);
    },
    removeEventListener: function(name, func, bool) {
      var index = this._listeners.indexOf(func);
      if (index == -1)
        throw new Error("event listener not found");
      this._listeners.splice(index, 1);
    },
    close: function() {
      timesClosed++;
      this._listeners.forEach(
        function(func) {
          func({target: fakeWindow.document});
        });
    },
    document: {
      get defaultView() { return fakeWindow; }
    }
  };

  let loader = Loader(module);
  loader.require("sdk/deprecated/window-utils").closeOnUnload(fakeWindow);
  assert.equal(fakeWindow._listeners.length, 1,
                   "unload listener added on closeOnUnload()");
  assert.equal(timesClosed, 0,
                   "window not closed when registered.");
  loader.unload();
  assert.equal(timesClosed, 1,
                   "window closed on module unload.");
  assert.equal(fakeWindow._listeners.length, 0,
                   "unload event listener removed on module unload");

  timesClosed = 0;
  loader = Loader(module);
  loader.require("sdk/deprecated/window-utils").closeOnUnload(fakeWindow);
  assert.equal(timesClosed, 0,
                   "window not closed when registered.");
  fakeWindow.close();
  assert.equal(timesClosed, 1,
                   "window closed when close() called.");
  assert.equal(fakeWindow._listeners.length, 0,
                   "unload event listener removed on window close");
  loader.unload();
  assert.equal(timesClosed, 1,
                   "window not closed again on module unload.");
};

exports.testWindowTracker = function(assert, done) {
  var myWindow;
  var finished = false;

  var delegate = {
    onTrack: function(window) {
      if (window == myWindow) {
        assert.pass("onTrack() called with our test window");
        timer.setTimeout(function() myWindow.close());
      }
    },
    onUntrack: function(window) {
      if (window == myWindow) {
        assert.pass("onUntrack() called with our test window");
        timer.setTimeout(function() {
          if (!finished) {
           finished = true;
           myWindow = null;
           wt.unload();
           done();
          }
          else {
           assert.fail("finishTest() called multiple times.");
          }
        });
      }
    }
  };

  // test bug 638007 (new is optional), using new
  var wt = new windowUtils.WindowTracker(delegate);
  myWindow = makeEmptyWindow();
};

exports.testWindowTrackerIgnoresPrivateWindows = function(assert, done) {
  var myWindow;
  var myWindowOpened = false;
  var myWindowClosed = false;
  var finished = false;
  var privateWindow;
  var privateWindowOpened = false;
  var privateWindowClosed = false;

  let { browserWindows: pbWindows } = pbLoader.require('windows');
  let pbWindowUtils = pbLoader.require('sdk/window/utils');

  var delegate = {
    onTrack: function(window) {
      if (window === myWindow) {
      if (pbUtils.isWindowPrivate(window)) {
        assert.fail('private window was tracked!');
      }
        myWindowOpened = true;
        assert.pass("onTrack() called with our test window");
        timer.setTimeout(function() myWindow.close());
      }
    },
    onUntrack: function(window) {
      if (pbUtils.isWindowPrivate(window)) {
        assert.fail('private window was tracked!');
      }
      if (window === myWindow) {
        timer.setTimeout(function() {
          assert.ok(privateWindowClosed);
          assert.equal(pbUtils.isWindowPBSupported, privateWindowOpened, 'private window was opened');
          wt.unload();
          done();
        });
      }
    }
  };
  var wt = windowUtils.WindowTracker(delegate);

  // make a new private window
  pbWindows.open({
    private: true,
    onOpen: function(win) {
      let window = privateWindow = getOwnerWindow(win);
      assert.ok(window instanceof Ci.nsIDOMWindow, "window was found");

      // PWPB case
      if (pbUtils.isWindowPBSupported) {
        assert.ok(pbUtils.isWindowPrivate(window), "window is private");
        assert.equal(pbWindowUtils.getFrames(window).length > 1, true, 'there are frames');
        assert.equal(pbWindowUtils.getWindowTitle(window), window.document.title,
                     'getWindowTitle works');
        assert.equal(getWindowTitle(window), null,
                     'getWindowTitle returns null for private window when they are not supported');
        privateWindowOpened = true;
      }
      win.close(function() privateWindowClosed = true);
    }
  });

  myWindow = makeEmptyWindow();
};

exports['test window watcher untracker'] = function(assert, done) {
  var myWindow;
  var tracks = 0;
  var unloadCalled = false;

  var delegate = {
    onTrack: function(window) {
      tracks = tracks + 1;
      if (window == myWindow) {
        assert.pass("onTrack() called with our test window");
        timer.setTimeout(function() {
          myWindow.close();
        }, 1);
      }
    },
    onUntrack: function(window) {
      tracks = tracks - 1;
      if (window == myWindow && !unloadCalled) {
        unloadCalled = true;
        timer.setTimeout(function() {
          wt.unload();
        }, 1);
      }
      if (0 > tracks) {
        assert.fail("WindowTracker onUntrack was called more times than onTrack..");
      }
      else if (0 == tracks) {
        timer.setTimeout(function() {
            myWindow = null;
            done();
        }, 1);
      }
    }
  };

  // test bug 638007 (new is optional), not using new
  var wt = windowUtils.WindowTracker(delegate);
  myWindow = makeEmptyWindow();
};

// test that _unregWindow calls _unregLoadingWindow
exports['test window watcher unregs 4 loading wins'] = function(assert, done) {
  var myWindow;
  var finished = false;
  let browserWindow =  Cc["@mozilla.org/appshell/window-mediator;1"]
      .getService(Ci.nsIWindowMediator)
      .getMostRecentWindow("navigator:browser");
  var counter = 0;

  var delegate = {
    onTrack: function(window) {
      var type = window.document.documentElement.getAttribute("windowtype");
      if (type == "test:window")
        assert.fail("onTrack shouldn't have been executed.");
    }
  };
  var wt = new windowUtils.WindowTracker(delegate);

  // make a new window
  myWindow = makeEmptyWindow();

  // make sure that the window hasn't loaded yet
  assert.notEqual(
      myWindow.document.readyState,
      "complete",
      "window hasn't loaded yet.");

  // unload WindowTracker
  wt.unload();

  // make sure that the window still hasn't loaded, which means that the onTrack
  // would have been removed successfully assuming that it doesn't execute.
  assert.notEqual(
      myWindow.document.readyState,
      "complete",
      "window still hasn't loaded yet.");

  // wait for the window to load and then close it. onTrack wouldn't be called
  // until the window loads, so we must let it load before closing it to be
  // certain that onTrack was removed.
  myWindow.addEventListener("load", function() {
    // allow all of the load handles to execute before closing
    myWindow.setTimeout(function() {
      myWindow.addEventListener("unload", function() {
        // once the window unloads test is done
        done();
      }, false);
      myWindow.close();
    }, 0);
  }, false);
}

exports['test window watcher without untracker'] = function(assert, done) {
  var myWindow;
  var finished = false;

  var delegate = {
    onTrack: function(window) {
      if (window == myWindow) {
        assert.pass("onTrack() called with our test window");
        timer.setTimeout(function() {
          myWindow.close();

          if (!finished) {
              finished = true;
              myWindow = null;
              wt.unload();
              done();
            } else {
              assert.fail("onTrack() called multiple times.");
            }
        }, 1);
      }
    }
  };

  var wt = new windowUtils.WindowTracker(delegate);
  myWindow = makeEmptyWindow();
};

exports['test active window'] = function(assert, done) {
  let browserWindow =  Cc["@mozilla.org/appshell/window-mediator;1"]
                      .getService(Ci.nsIWindowMediator)
                      .getMostRecentWindow("navigator:browser");
  let continueAfterFocus = function(window) onFocus(window, nextTest);

  assert.equal(windowUtils.activeBrowserWindow, browserWindow,
               "Browser window is the active browser window.");


  let testSteps = [
    function() {
      continueAfterFocus(windowUtils.activeWindow = browserWindow);
    },
    function() {
      assert.equal(windowUtils.activeWindow, browserWindow,
                       "Correct active window [1]");
      nextTest();
    },
    function() {
      assert.equal(windowUtils.activeBrowserWindow, browserWindow,
                       "Correct active browser window [2]");
      continueAfterFocus(windowUtils.activeWindow = browserWindow);
    },
    function() {
      assert.equal(windowUtils.activeWindow, browserWindow,
                       "Correct active window [3]");
      nextTest();
    },
    function() {
      assert.equal(windowUtils.activeBrowserWindow, browserWindow,
                       "Correct active browser window [4]");
      done();
    }
  ];

  function nextTest() {
    if (testSteps.length)
      testSteps.shift()();
  }
  nextTest();
};

exports.testActiveWindowIgnoresPrivateWindow = function(assert, done) {
  let {browserWindows: pbWindows } = pbLoader.require('windows');
  let pbWindowUtils = pbLoader.require('sdk/deprecated/window-utils');

  // make a new private window
  pbWindows.open({
    private: true,
    onOpen: function(win) {
      let window = getOwnerWindow(win);
      assert.ok(window instanceof Ci.nsIDOMWindow, "window was found");

      // pb mode not supported
      assert.equal(isPrivate(windowUtils.activeWindow), false,
                   "active window is not private when pb mode is not supported");
      assert.equal(isPrivate(windowUtils.activeBrowserWindow), false,
                   "active browser window is not private when pb mode is not supported");

      // PWPB case
      if (pbUtils.isWindowPBSupported) {
        assert.ok(pbUtils.isWindowPrivate(window), "window is private");

        // pb mode is supported
        assert.ok(
          pbUtils.isWindowPrivate(pbWindowUtils.activeWindow),
          "active window is private when pb mode is supported");
        assert.ok(
          pbUtils.isWindowPrivate(pbWindowUtils.activeBrowserWindow),
          "active browser window is private when pb mode is supported");
      }
      // Global case
      else {
        assert.equal(pbUtils.isWindowPrivate(window), false, "window is not private");
      }
      win.close(function() done());
    }
  });
}

exports['test windowIterator'] = function(assert, done) {
  // make a new window
  let window = makeEmptyWindow();

  // make sure that the window hasn't loaded yet
  assert.notEqual(
      window.document.readyState,
      "complete",
      "window hasn't loaded yet.");

  // this window should only appear in windowIterator() while its loading
  assert.ok(toArray(windowUtils.windowIterator()).indexOf(window) === -1,
            "window isn't in windowIterator()");

  // Then it should be in windowIterator()
  window.addEventListener("load", function onload() {
    window.addEventListener("load", onload, false);
    assert.ok(toArray(windowUtils.windowIterator()).indexOf(window) !== -1,
              "window is now in windowIterator()");

    // Wait for the window unload before ending test
    close(window, done);
  }, false);
};


exports.testWindowIteratorIgnoresPrivateWindows = function(assert, done) {
  // make a new private window
  pbLoader.require('windows').browserWindows.open({
    private: true,
    onOpen: function(win) {
      let window = getOwnerWindow(win);
      assert.ok(window instanceof Ci.nsIDOMWindow, "window was found");
      // PWPB case
      if (pbUtils.isWindowPBSupported) {
        assert.ok(pbUtils.isWindowPrivate(window), "window is private");
        assert.equal(toArray(windowUtils.windowIterator()).indexOf(window), -1,
                     "window is not in windowIterator()");
      }
      // Global case
      else {
        assert.equal(pbUtils.isWindowPrivate(window), false, "window is not private");
        assert.ok(toArray(windowUtils.windowIterator()).indexOf(window) > -1,
                  "window is in windowIterator()"); 
      }
      win.close(function() done());
    }
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
