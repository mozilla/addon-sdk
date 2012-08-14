/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require('chrome');
const { Loader } = require('test-harness/loader');
const timer = require('timer');
const tabs = require('tabs');
//const {tabs} = require('api-utils/windows/tabs-fennec');
const windows = require('windows');
const xulApp = require("xul-app");

const tabsLen = tabs.length;
const URL = 'data:text/html;charset=utf-8,<html><head><title>#title#</title></head></html>';

// TEST: tabs.activeTab getter
exports.testActiveTab_getter = function(test) {
  test.waitUntilDone();

  let url = URL.replace("#title#", "foo");
  tabs.open({
    url: url,
    onOpen: function(tab) {
      test.assert(!!tabs.activeTab);
      test.assertEqual(tabs.activeTab, tab);

      tab.on("ready", function() {
        test.assertEqual(tab.url, url);
        test.assertEqual(tab.title, "foo");

        tab.close(function() {
          test.assertEqual(tabs.length, tabsLen, "tab was closed");

          // end test
          test.done();
        });
      });
    }
  });
};

// TEST: activeWindow getter and activeTab getter on tab 'activate' event
exports.testActiveWindowActiveTabOnActivate = function(test) {
  test.waitUntilDone();

  let windows = require("windows").browserWindows;
  let activateCount = 0;
  let newTabs = [];

  tabs.on('activate', function onActivate(tab) {
    test.assertEqual(windows.activeWindow.tabs.activeTab, tab,
                    "the active window's active tab is the tab provided");
    newTabs.push(tab);

    if (++activateCount == 2) {
      tabs.removeListener('activate', onActivate);

      newTabs.forEach(function(tab) {
        tab.close(function() {
          if (--activateCount == 0) {
            test.assertEqual(tabs.length, tabsLen, "tabs were closed");

            // end test
            test.done();
          }
        });
      });
    }
    else if (activateCount > 2) {
      test.fail("activateCount is greater than 2 for some reason..");
    }
  });

  windows.open({
    url: URL.replace("#title#", "windows.open"),
    onOpen: function(window) {
      tabs.open({
        url: URL.replace("#title#", "tabs.open")
      });
    }
  });
};

// TEST: tab.activate()
exports.testActiveTab_setter = function(test) {
  test.waitUntilDone();

  let url = URL.replace("#title#", "foo");
  let activeTabURL = tabs.activeTab.url;

  tabs.once('ready', function onReady(tab) {
    test.assertEqual(tabs.activeTab.url, activeTabURL, "activeTab url has not changed");
    test.assertEqual(tab.url, url, "url of new background tab matches");

    tabs.once('activate', function onActivate(eventTab) {
      test.assertEqual(tabs.activeTab.url, url, "url after activeTab setter matches");
      test.assertEqual(eventTab, tab, "event argument is the activated tab");
      test.assertEqual(eventTab, tabs.activeTab, "the tab is the active one");

      tab.close(function() {
        // end test
        test.done();
      });
    });

    tab.activate();
  });

  tabs.open({
    url: url,
    inBackground: true
  });
};

// TEST: tab unloader
exports.testAutomaticDestroy = function(test) {
  test.waitUntilDone();

  let called = false;

  let loader = Loader(module);
  let tabs2 = loader.require("tabs");
  let tabs2Len = tabs2.length;
  tabs2.on('open', function onOpen(tab) {
    test.fail("an onOpen listener was called that should not have been");
    called = true;
  });

  loader.unload();

  // Fire a tab event and ensure that the destroyed tab is inactive
  tabs.once('open', function(tab) {
    test.pass('tabs.once("open") works!');

    test.assertEqual(tabs2Len, tabs2.length, "tabs2 length was not changed");
    test.assertEqual(tabs.length, (tabs2.length+1), "tabs.length > tabs2.length");

    timer.setTimeout(function () {
      test.assert(!called, "Unloaded tab module is destroyed and inactive");

      tab.close(function() {
        // end test
        test.done();
      });
    });
  });

  tabs.open("data:text/html;charset=utf-8,foo");
};

// TEST: tab properties
exports.testTabProperties = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,<html><head><title>foo</title></head><body>foo</body></html>";
  tabs.open({
    url: url,
    onReady: function(tab) {
      test.assertEqual(tab.title, "foo", "title of the new tab matches");
      test.assertEqual(tab.url, url, "URL of the new tab matches");
      // TODO: uncomment below, and fix!
      test.assert(tab.favicon, "favicon of the new tab is not empty");
      test.assertEqual(tab.style, null, "style of the new tab matches");
      test.assertEqual(tab.index, 1, "index of the new tab matches");
      test.assertNotEqual(tab.getThumbnail(), null, "thumbnail of the new tab matches");

      tab.close(function() {
        // end test
        test.done();
      });
    }
  });
};

// TEST: tabs iterator and length property
exports.testTabsIteratorAndLength = function(test) {
  test.waitUntilDone();

  let newTabs = [];
  let startCount = 0;
  for each (let t in tabs) startCount++;

  test.assertEqual(startCount, tabs.length, "length property is correct");

  let url = "data:text/html;charset=utf-8,default";
  tabs.open({url: url, onOpen: function(tab) newTabs.push(tab)});
  tabs.open({url: url, onOpen: function(tab) newTabs.push(tab)});
  tabs.open({
    url: url,
    onOpen: function(tab) {
      let count = 0;
      for each (let t in tabs) count++;
      test.assertEqual(count, startCount + 3, "iterated tab count matches");
      test.assertEqual(startCount + 3, tabs.length, "iterated tab count matches length property");

      let newTabsLength = newTabs.length;
      newTabs.forEach(function(t) t.close(function() {
        if (--newTabsLength > 0) return;

        tab.close(function() {
          test.assertEqual(tabs.length, tabsLen, "tabs were closed");

          // end test
          test.done();
        });
      }));
    }
  });
};

// TEST: tab.url setter
exports.testTabLocation = function(test) {
  test.waitUntilDone();

  let url1 = "data:text/html;charset=utf-8,foo";
  let url2 = "data:text/html;charset=utf-8,bar";

  tabs.on('ready', function onReady(tab) {
    if (tab.url != url2)
      return;

    tabs.removeListener('ready', onReady);
    test.pass("tab loaded the correct url");

    tab.close(function() {
      // end test
      test.done();
    });
  });

  tabs.open({
    url: url1,
    onOpen: function(tab) {
      tab.url = url2;
    }
  });
};

// TEST: tab.close()
exports.testTabClose = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,foo";

  test.assertNotEqual(tabs.activeTab.url, url, "tab is now the active tab");

  tabs.once('ready', function onReady(tab) {
    test.assertEqual(tabs.activeTab.url, tab.url, "tab is now the active tab");

    tab.close(function() {
      test.assertNotEqual(tabs.activeTab.url, url, "tab is no longer the active tab");

      // end test
      test.done();
    });
  });

  tabs.open(url);
};

// TEST: tab.reload()
exports.testTabReload = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,<!doctype%20html><title></title>";

  tabs.open({
    url: url,
    onReady: function onReady(tab) {
      tab.removeListener('ready', onReady);

      tab.once(
        'ready',
        function onReload() {
          test.pass("the tab was loaded again");
          test.assertEqual(tab.url, url, "the tab has the same URL");

          // end test
          tab.close(function() test.done());
        }
      );

      tab.reload();
    }
  });
};

// TEST: tab.move()
exports.testTabMove = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,foo";

  test.assertEqual(tabs.length, 1, "there is only one tab open");

  tabs.open({
    url: url,
    onOpen: function(tab) {
      test.assertEqual(tab.index, 1, "tab index before move matches");
      tab.index = 0;
      test.assertEqual(tab.index, 0, "tab index after move matches");

      // end test
      tab.close(function() test.done());
    }
  });
};

// TEST: open tab with default options
exports.testOpen = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,default";

  tabs.open({
    url: url,
    onReady: function(tab) {
      test.assertEqual(tab.url, url, "URL of the new tab matches");
      test.assertEqual(tabs.activeTab, tab, "URL of active tab in the current window matches");
      test.assertEqual(tab.isPinned, false, "The new tab is not pinned");

      // end test
      tab.close(function() test.done());
    }
  });
};

// TEST: open pinned tab
exports.testOpenPinned = function(test) {
  if (xulApp.versionInRange(xulApp.platformVersion, "2.0b2", "*")) {
    // test tab pinning
    test.waitUntilDone();

    let url = "data:text/html;charset=utf-8,default";
    tabs.open({
      url: url,
      isPinned: true,
      onOpen: function(tab) {
        test.assertEqual(tab.isPinned, true, "The new tab is pinned");

        // end test
        tab.close(function() test.done());
      }
    });
  }
  else {
    test.pass("Pinned tabs are not supported in this application.");
  }
};

// TEST: pin/unpin opened tab
exports.testPinUnpin = function(test) {
  if (xulApp.versionInRange(xulApp.platformVersion, "2.0b2", "*")) {
    test.waitUntilDone();

    let url = "data:text/html;charset=utf-8,default";
    tabs.open({
      url: url,
      onOpen: function(tab) {
        tab.pin();
        test.assertEqual(tab.isPinned, true, "The tab was pinned correctly");
        tab.unpin();
        test.assertEqual(tab.isPinned, false, "The tab was unpinned correctly");

        // end test
        tab.close(function() test.done());
      }
    });
  }
  else {
    test.pass("Pinned tabs are not supported in this application.");
  }
};

// TEST: open tab in background
exports.testInBackground = function(test) {
  test.waitUntilDone();

  let activeUrl = tabs.activeTab.url;
  let url = "data:text/html;charset=utf-8,background";
  let window = windows.browserWindows.activeWindow;
  tabs.once('ready', function onReady(tab) {
    test.assertEqual(tabs.activeTab.url, activeUrl, "URL of active tab has not changed");
    test.assertEqual(tab.url, url, "URL of the new background tab matches");
    test.assertEqual(windows.browserWindows.activeWindow, window, "a new window was not opened");
    test.assertNotEqual(tabs.activeTab.url, url, "URL of active tab is not the new URL");

    // end test
    tab.close(function() test.done());
  });

  tabs.open({
    url: url,
    inBackground: true
  });
};

// TEST: open tab in new window
exports.testOpenInNewWindow = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,newwindow";
  let window = windows.browserWindows.activeWindow;

  tabs.open({
    url: url,
    inNewWindow: true,
    onReady: function(tab) {
      test.assertEqual(windows.browserWindows.length, 1, "a new window was not opened");
      test.assertEqual(windows.browserWindows.activeWindow, window, "old window is active");
      test.assertEqual(tab.url, url, "URL of the new tab matches");
      test.assertEqual(tabs.activeTab, tab, "tab is the activeTab");

      tab.close(function() test.done());
    }
  });
};

// TEST: onOpen event handler
exports.testTabsEvent_onOpen = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,1";
  let eventCount = 0;

  // add listener via property assignment
  function listener1(tab) {
    eventCount++;
  };
  tabs.on('open', listener1);

  // add listener via collection add
  tabs.on('open', function listener2(tab) {
    test.assertEqual(++eventCount, 2, "both listeners notified");
    tabs.removeListener('open', listener1);
    tabs.removeListener('open', listener2);

    // ends test
    tab.close(function() test.done());
  });

  tabs.open(url);
};

// TEST: onClose event handler
exports.testTabsEvent_onClose = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,onclose";
  let eventCount = 0;

  // add listener via property assignment
  function listener1(tab) {
    eventCount++;
  }
  tabs.on('close', listener1);

  // add listener via collection add
  tabs.on('close', function listener2(tab) {
    test.assertEqual(++eventCount, 2, "both listeners notified");
    tabs.removeListener('close', listener1);
    tabs.removeListener('close', listener2);

    // end test
    test.done();
  });

  tabs.on('ready', function onReady(tab) {
    tabs.removeListener('ready', onReady);
    tab.close();
  });

  tabs.open(url);
};

// TEST: onClose event handler when a window is closed
exports.testTabsEvent_onCloseWindow = function(test) {
  test.waitUntilDone();

  let closeCount = 0, individualCloseCount = 0;
  function listener() {
    closeCount++;
  }
  tabs.on('close', listener);

  // One tab is already open with the window
  let openTabs = 0;
  function testCasePossiblyLoaded(tab) {
    tab.close(function() {
      if (++openTabs == 3) {
        tabs.removeListener("close", listener);

        test.assertEqual(closeCount, 3, "Correct number of close events received");
        test.assertEqual(individualCloseCount, 3,
                         "Each tab with an attached onClose listener received a close " +
                         "event when the window was closed");

        test.done();
      }
    });
  }

  tabs.open({
    url: "data:text/html;charset=utf-8,tab2",
    onOpen: testCasePossiblyLoaded,
    onClose: function() individualCloseCount++
  });

  tabs.open({
    url: "data:text/html;charset=utf-8,tab3",
    onOpen: testCasePossiblyLoaded,
    onClose: function() individualCloseCount++
  });

  tabs.open({
    url: "data:text/html;charset=utf-8,tab4",
    onOpen: testCasePossiblyLoaded,
    onClose: function() individualCloseCount++
  });
};
