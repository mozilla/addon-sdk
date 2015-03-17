/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { setTimeout } = require('sdk/timers');
const { Loader } = require('sdk/test/loader');
const { onFocus, getMostRecentWindow, windows, isBrowser, getWindowTitle, isFocused } = require('sdk/window/utils');
const { open, close, focus } = require('sdk/window/helpers');
const { browserWindows } = require("sdk/windows");
const tabs = require("sdk/tabs");
const winUtils = require("sdk/deprecated/window-utils");
const { isPrivate } = require('sdk/private-browsing');
const { isWindowPBSupported } = require('sdk/private-browsing/utils');
const { viewFor } = require("sdk/view/core");
const { defer } = require("sdk/lang/functional");
const { cleanUI } = require("sdk/test/utils");
const { after } = require("sdk/test/utils");
const { nuke } = require("sdk/loader/sandbox");
const systemEvents = require("sdk/system/events");

// TEST: open & close window
exports.testOpenAndCloseWindow = function(assert, done) {
  assert.equal(browserWindows.length, 1, "Only one window open");
  let title = 'testOpenAndCloseWindow';

  browserWindows.open({
    url: "data:text/html;charset=utf-8,<title>" + title + "</title>",
    onOpen: function(window) {
      assert.equal(this, browserWindows, "The 'this' object is the windows object.");
      assert.equal(window.tabs.length, 1, "Only one tab open");
      assert.equal(browserWindows.length, 2, "Two windows open");

      window.tabs.activeTab.once('ready', function onReady(tab) {
        assert.pass(RegExp(title).test(window.title), "URL correctly loaded");
        window.close();
      });
    },
    onClose: function(window) {
      assert.equal(window.tabs.length, 0, "Tabs were cleared");
      assert.equal(browserWindows.length, 1, "Only one window open");
      done();
    }
  });
};

exports.testNeWindowIsFocused = function(assert, done) {
  let mainWindow = browserWindows.activeWindow;

  browserWindows.open({
    url: "about:blank",
    onOpen: function(window) {
      focus(viewFor(window)).then((window) => {
        assert.ok(isFocused(window), 'the new window is focused');
        assert.ok(isFocused(browserWindows.activeWindow), 'the active window is focused');
        assert.ok(!isFocused(mainWindow), 'the main window is not focused');
        done();
      })
    }
  });
}

exports.testOpenRelativePathWindow = function(assert, done) {
  assert.equal(browserWindows.length, 1, "Only one window open");

  const { merge } = require("sdk/util/object");
  const self = require("sdk/self");

  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, require("./../fixtures"))
      })
    }
  });

  loader.require("sdk/windows").browserWindows.open({
    url: "./test.html",
    onOpen: (window) => {
      window.tabs.activeTab.once("ready", (tab) => {
        assert.equal(tab.title, "foo",
          "tab opened a document with relative path");
        done();
      });
    }
  })
}

exports.testAutomaticDestroy = function(assert, done) {
  let windows = browserWindows;

  // Create a second windows instance that we will unload
  let called = false;
  let loader = Loader(module);
  let windows2 = loader.require("sdk/windows").browserWindows;

  windows2.on("open", function() {
    called = true;
  });

  loader.unload();

  // Fire a windows event and check that this unloaded instance is inactive
  windows.open({
    url: "data:text/html;charset=utf-8,foo",
    onOpen: function(window) {
      setTimeout(function () {
        assert.ok(!called, "Unloaded windows instance is destroyed and inactive");
        done();
      });
    }
  });
};

exports.testWindowTabsObject = function(assert, done) {
  let window, count = 0;
  function runTest() {
    if (++count != 2)
      return;

    assert.equal(window.tabs.length, 1, "Only 1 tab open");
    assert.equal(window.tabs.activeTab.title, "tab 1", "Correct active tab");

    window.tabs.open({
      url: "data:text/html;charset=utf-8,<title>tab 2</title>",
      inBackground: true,
      onReady: function onReady(newTab) {
        assert.equal(window.tabs.length, 2, "New tab open");
        assert.equal(newTab.title, "tab 2", "Correct new tab title");
        assert.equal(window.tabs.activeTab.title, "tab 1", "Correct active tab");

        let i = 1;
        for (let tab of window.tabs)
          assert.equal(tab.title, "tab " + i++, "Correct title");

        window.close();
      }
    });
  }

  tabs.once("ready", runTest);

  browserWindows.open({
    url: "data:text/html;charset=utf-8,<title>tab 1</title>",
    onActivate: function onActivate(win) {
      window = win;
      runTest();
    },
    onClose: function onClose(window) {
      assert.equal(window.tabs.length, 0, "No more tabs on closed window");
      done();
    }
  });
};

exports.testOnOpenOnCloseListeners = function(assert, done) {
  let windows = browserWindows;

  assert.equal(browserWindows.length, 1, "Only one window open");

  let received = {
    listener1: false,
    listener2: false,
    listener3: false,
    listener4: false
  }

  function listener1() {
    assert.equal(this, windows, "The 'this' object is the windows object.");

    if (received.listener1)
      assert.fail("Event received twice");
    received.listener1 = true;
  }

  function listener2() {
    if (received.listener2)
      assert.fail("Event received twice");
    received.listener2 = true;
  }

  function listener3() {
    assert.equal(this, windows, "The 'this' object is the windows object.");
    if (received.listener3)
      assert.fail("Event received twice");
    received.listener3 = true;
  }

  function listener4() {
    if (received.listener4)
      assert.fail("Event received twice");
    received.listener4 = true;
  }

  windows.on('open', listener1);
  windows.on('open', listener2);
  windows.on('close', listener3);
  windows.on('close', listener4);

  windows.open({
    url: "data:text/html;charset=utf-8,foo",
    onOpen: function(window) {
      window.close(function() {
        assert.ok(received.listener1, "onOpen handler called");
        assert.ok(received.listener2, "onOpen handler called");
        assert.ok(received.listener3, "onClose handler called");
        assert.ok(received.listener4, "onClose handler called");

        windows.removeListener('open', listener1);
        windows.removeListener('open', listener2);
        windows.removeListener('close', listener3);
        windows.removeListener('close', listener4);

        done();
      });
    }
  });
};

exports.testActiveWindow = function*(assert) {
  let windows = browserWindows;

  // API window objects
  let window2, window3;

  // Raw window objects
  let rawWindow2, rawWindow3;

  yield new Promise(resolve => {
    windows.open({
      url: "data:text/html;charset=utf-8,<title>window 2</title>",
      onOpen: (window) => {
        assert.pass('window 2 open');

        window.tabs.activeTab.once('ready', () => {
          assert.pass('window 2 tab activated');

          window2 = window;
          rawWindow2 = viewFor(window);

          assert.equal(rawWindow2.content.document.title, "window 2", "Got correct raw window 2");
          assert.equal(rawWindow2.document.title, window2.title, "Saw correct title on window 2");

          windows.open({
            url: "data:text/html;charset=utf-8,<title>window 3</title>",
            onOpen: (window) => {
              assert.pass('window 3 open');

              window.tabs.activeTab.once('ready', () => {
                assert.pass('window 3 tab activated');

                window3 = window;
                rawWindow3 = viewFor(window);

                assert.equal(rawWindow3.content.document.title, "window 3", "Got correct raw window 3");
                assert.equal(rawWindow3.document.title, window3.title, "Saw correct title on window 3");

                resolve();
              });
            }
          });
        });
      }
    });
  });

  yield focus(rawWindow3);

  assert.equal(windows.length, 3, "Correct number of browser windows");

  let count = 0;
  for (let window in windows) {
    count++;
  }
  assert.equal(count, 3, "Correct number of windows returned by iterator");
  assert.equal(windows.activeWindow.title, window3.title, "Correct active window title - 3");

  yield focus(rawWindow2);

  assert.equal(windows.activeWindow.title, window2.title, "Correct active window title - 2");

  yield new Promise(resolve => {
    onFocus(rawWindow2).then(resolve);
    window2.activate();
    assert.pass("activating window2");
  });

  assert.equal(windows.activeWindow.title, window2.title, "Correct active window - 2");

  yield new Promise(resolve => {
    onFocus(rawWindow3).then(resolve);
    window3.activate();
    assert.pass("activating window3");
  });

  assert.equal(windows.activeWindow.title, window3.title, "Correct active window - 3");

  yield close(rawWindow2);
  assert.equal(rawWindow2.closed, true, 'window 2 is closed');

  yield close(rawWindow3);
  assert.equal(rawWindow3.closed, true, 'window 3 is closed');
};

exports.testTrackWindows = function(assert, done) {
  let windows = [];
  let actions = [];

  let expects = [
    "activate 0", "global activate 0", "deactivate 0", "global deactivate 0",
    "activate 1", "global activate 1", "deactivate 1", "global deactivate 1",
    "activate 2", "global activate 2"
  ];

  function windowsActivation(window) {
    let index = windows.indexOf(window);
    // only concerned with windows opened for this test
    if (index < 0)
      return;

    assert.equal(actions.join(), expects.slice(0, index*4 + 1).join(), expects[index*4 + 1]);
    actions.push("global activate " + index)
  }

  function windowsDeactivation(window) {
    let index = windows.indexOf(window);
    // only concerned with windows opened for this test
    if (index < 0)
      return;

    assert.equal(actions.join(), expects.slice(0, index*4 + 3).join(), expects[index*4 + 3]);
    actions.push("global deactivate " + index)
  }

  // listen to global activate events
  browserWindows.on("activate", windowsActivation);

  // listen to global deactivate events
  browserWindows.on("deactivate", windowsDeactivation);


  function openWindow() {
    windows.push(browserWindows.open({
      url: "data:text/html;charset=utf-8,<i>testTrackWindows</i>",
      onActivate: function(window) {
        let index = windows.indexOf(window);

        // Guard against windows that have already been removed.
        // See bug 874502 comment 32.
        if (index == -1)
          return;

        assert.equal(actions.join(),
                     expects.slice(0, index*4).join(),
                     "expecting " + expects[index*4]);
        actions.push("activate " + index);

        if (windows.length < 3) {
          openWindow()
        }
        else {
          (function closeWindows(windows) {
            if (!windows.length) {
              browserWindows.removeListener("activate", windowsActivation);
              browserWindows.removeListener("deactivate", windowsDeactivation);
              return done();
            }

            return windows.pop().close(function() {
              assert.pass('window was closed');
              closeWindows(windows);
            });
          })(windows)
        }
      },
      onDeactivate: function(window) {
        let index = windows.indexOf(window);

        // Guard against windows that have already been removed.
        // See bug 874502 comment 32.
        if (index == -1)
          return;

        assert.equal(actions.join(),
                     expects.slice(0, index*4 + 2).join(),
                     "expecting " + expects[index*4 + 2]);
        actions.push("deactivate " + index)
      }
    }));
  }
  openWindow();
}

// test that it is not possible to open a private window by default
exports.testWindowOpenPrivateDefault = function(assert, done) {
  browserWindows.open({
    url: 'about:mozilla',
    isPrivate: true,
    onOpen: function(window) {
      let tab = window.tabs[0];

      tab.once('ready', function() {
        assert.equal(tab.url, 'about:mozilla', 'opened correct tab');
        assert.equal(isPrivate(tab), false, 'tab is not private');

        done();
      });
    }
  });
}

// test that it is not possible to find a private window in
// windows module's iterator
exports.testWindowIteratorPrivateDefault = function*(assert) {
  assert.equal(browserWindows.length, 1, 'only one window open');

  let window = yield open('chrome://browser/content/browser.xul', {
    features: {
      private: true,
      chrome: true
    }
  });

  yield focus(window);

  // test that there is a private window opened
  assert.equal(isPrivate(window), true, 'there is a private window open');
  assert.strictEqual(window, winUtils.activeWindow);
  assert.strictEqual(window, getMostRecentWindow());

  assert.ok(!isPrivate(browserWindows.activeWindow));

  assert.equal(browserWindows.length, 1, 'only one window in browserWindows');
  assert.equal(windows().length, 1, 'only one window in windows()');

  assert.equal(windows(null, { includePrivate: true }).length, 2);

  // test that all windows in iterator are not private
  for (let window of browserWindows) {
    assert.ok(!isPrivate(window), 'no window in browserWindows is private');
  }
};

exports["test getView(window)"] = function(assert, done) {
  browserWindows.once("open", window => {
    const view = viewFor(window);

    assert.ok(view instanceof Ci.nsIDOMWindow, "view is a window");
    assert.ok(isBrowser(view), "view is a browser window");
    assert.equal(getWindowTitle(view), window.title,
                 "window has a right title");

    window.close();
    // Defer handler cause window is destroyed after event is dispatched.
    browserWindows.once("close", defer(_ => {
      assert.equal(viewFor(window), null, "window view is gone");
      done();
    }));
  });

  browserWindows.open({ url: "data:text/html,<title>yo</title>" });
};

exports.testNoDeadObjectsOnUnload = function(assert, done) {
  let loader = Loader(module);
  let { browserWindows } = loader.require("sdk/windows");

  systemEvents.on("console-api-log-event", onConsoleMessage);

  function cleanup() {
    systemEvents.off("console-api-log-event", onConsoleMessage);
  }

  // Fail if we get a dead object message on the console.
  function onConsoleMessage({ subject }) {
    let message = subject.wrappedJSObject;
    let text = message.arguments[0] + "";

    if (new RegExp("can't access dead object", "i").test(text)) {
      cleanup();
      assert.fail(text);
      done();
    }
    else if (text == "testNoDeadObjectsOnUnload test complete") {
      cleanup();
      assert.pass("no dead object errors");
      done();
    }
  }

  browserWindows.open({
    url: "data:text/html;charset=utf-8,test-window",
    onOpen: (window) => {
      // Defer till the end of the event queue
      setTimeout(() => {
        systemEvents.once("sdk:loader:destroy", function() {
          // Nuke the sandboxes of all the loaded modules.
          // This step creates the dead objects.
          for (let name in loader.sandboxes) {
            nuke(loader.sandboxes[name]);
          }

          setTimeout(() => console.log("testNoDeadObjectsOnUnload test complete"));
        });

        loader.unload();
      });
    }
  });
};

after(exports, function*(name, assert) {
  yield cleanUI();
});

require('sdk/test').run(exports);
