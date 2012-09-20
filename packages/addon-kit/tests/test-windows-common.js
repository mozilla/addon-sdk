/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const wm = Cc['@mozilla.org/appshell/window-mediator;1'].
           getService(Ci.nsIWindowMediator);
const { Loader } = require('test-harness/loader');
const { browserWindows } = require('windows');
const privateBrowsing = require('private-browsing');
const pbUtils = require('api-utils/private-browsing/utils');

// TEST: browserWindows Iterator
exports.testBrowserWindowsIterator = function(test) {
  let activeWindowCount = 0;
  let windows = [];
  let i = 0;
  for each (let window in browserWindows) {
    if (window === browserWindows.activeWindow)
      activeWindowCount++;

    test.assertEqual(windows.indexOf(window), -1, 'window not already in iterator');
    test.assertEqual(browserWindows[i++], window, 'browserWindows[x] works');
    windows.push(window);
  }
  test.assertEqual(activeWindowCount, 1, 'activeWindow was found in the iterator');

  i = 0;
  for (let j in browserWindows) {
    test.assertEqual(j, i++, 'for (x in browserWindows) works');
  }
};

if (pbUtils.isWindowPBEnabled(wm.getMostRecentWindow('navigator:browser'))) {
  exports.testPerWindowPrivateBrowsing_getter = function(test) {
    let activeWindow =  wm.getMostRecentWindow('navigator:browser');
  
    // is per-window PB implemented?
    let currentState = activeWindow.gPrivateBrowsingUI.privateWindow;
  
    pbUtils.setMode(false, activeWindow);
  
    test.assertEqual(activeWindow.gPrivateBrowsingUI.privateWindow,
                     browserWindows.activeWindow.isPrivateBrowsing,
                     "Active window is not in PB mode");
  
    pbUtils.setMode(true, activeWindow);
  
    test.assertEqual(activeWindow.gPrivateBrowsingUI.privateWindow,
                     browserWindows.activeWindow.isPrivateBrowsing,
                     "Active window is in PB mode");
  
    pbUtils.setMode(currentState, activeWindow);
  };
  
  exports.testPerWindowPrivateBrowsing_events = function(test) {
    test.waitUntilDone();
  
    let chromeWin;
  
    let setPBMode = function(mode) pbUtils.setMode(mode, chromeWin);
  
    let windows = browserWindows;
    let windowCount = browserWindows.length;
    let testWindow;
  
    let globalCount = 0;
    windows.on('private-browsing', function onGlobalPB(window) {
      if (testWindow != window) return; // ignore windows not involved in the test (if any)
      if (++globalCount == 2) // stop listening after 2 PB state changes
        windows.removeListener('private-browsing', onGlobalPB);
    });
  
    testWindow = browserWindows.open({
      url: "data:text/html;charset=utf-8,foo",
      onOpen: function(window) {
        test.assertEqual(window.isPrivateBrowsing, false, 'newly opened window is not in PB mode');
  
        chromeWin = wm.getMostRecentWindow("navigator:browser");
  
        let count = 0;
        window.on('private-browsing', function onPB(window) {
          if (++count == 1) {
            test.assertEqual(window.isPrivateBrowsing, true, 'window is in PB mode');
            setPBMode(false);
          }
          else if (count == 2) {
            test.assertEqual(privateBrowsing.isActive, false, 'private browsing is disabled');
            test.assertEqual(window.isPrivateBrowsing, false, 'window is in not PB mode');
            window.removeListener('private-browsing', onPB);
  
            let (counter = 0) {
              window.on('private-browsing', function onPB2(window) {
                if (++counter != 2) return;
                window.removeListener('private-browsing', onPB2);
  
                // close the window
                window.close(function() {
                  test.assertEqual(window.isPrivateBrowsing, false, 'window is in not PB mode');
                  test.assertEqual(count, 2, 'window private browsing listener was not removed');
                  test.assertEqual(globalCount, 2, 'window private browsing listener was not removed');
                  test.assertEqual(windowCount, browserWindows.length, 'window count is unchanged');
  
                  // end test
                  test.done();
                });
              });
  
              // our listener is now off, so let's test that worked..
              setPBMode(true);
              setPBMode(false);
            }
          }
          else {
            test.fail('window private browsing listener was not removed');
          }
        });
  
        setPBMode(true);
      }
    });
  };
  
  exports.testPerWindowPrivateBrowsing_eventsUnload = function(test) {
    test.waitUntilDone();
  
    let chromeWin;
    let setPBMode = function(mode) pbUtils.setMode(mode, chromeWin);
    let loader = Loader(module);
    let {browserWindows: windows} = loader.require('windows');
    let testWindow;
    let count = 0;
    let globalCount = 0;
  
    browserWindows.on('private-browsing', function onGlobalPB(window) {
      if (testWindow != window) return; // ignore windows not involved in the test (if any)
      if (++globalCount == 2) { // stop listening after 2 PB state changes
        browserWindows.removeListener('private-browsing', onGlobalPB);
  
        test.assertEqual(window.isPrivateBrowsing, false, 'PB mode is off');
        test.assertEqual(globalCount, 2, 'total calls to setPBMode is correct');
        test.assertEqual(count, 1, 'unload of PB listener worked');
  
        window.close(function() {
  
          // end test
          test.done();
        });
      }
      else {
        setPBMode(!window.isPrivateBrowsing);
      }
    });
  
    testWindow = windows.open({
      url: "data:text/html;charset=utf-8,foo",
      onOpen: function(window) {
        test.assertEqual(window.isPrivateBrowsing, false, 'newly opened window is not in PB mode');
        testWindow = browserWindows.activeWindow;
  
        chromeWin = wm.getMostRecentWindow("navigator:browser");
  
        window.on('private-browsing', function() {
          count++;
          loader.unload();
        });
  
        setPBMode(true);
      }
    });
  };
}

exports.testWindowTabsObject_alt = function(test) {
  test.waitUntilDone();

  let window = browserWindows.activeWindow;
  window.tabs.open({
    url: "data:text/html;charset=utf-8,<title>tab 2</title>",
    inBackground: true,
    onReady: function onReady(tab) {
      test.assertEqual(tab.title, "tab 2", "Correct new tab title");
      test.assertNotEqual(window.tabs.activeTab, tab, "Correct active tab");

      // end test
      tab.close(test.done());
    }
  });
};

// TEST: browserWindows.activeWindow
exports.testWindowActivateMethod_simple = function(test) {
  let window = browserWindows.activeWindow;
  let tab = window.tabs.activeTab;

  window.activate();

  test.assertEqual(browserWindows.activeWindow, window,
                   "Active window is active after window.activate() call");
  test.assertEqual(window.tabs.activeTab, tab,
                   "Active tab is active after window.activate() call");
  
};
