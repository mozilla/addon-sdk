/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { Loader } = require('sdk/test/loader');
const timer = require('sdk/timers');
const tabs = require('sdk/tabs');
const windows = require('sdk/windows');

const tabsLen = tabs.length;
const URL = 'data:text/html;charset=utf-8,<html><head><title>#title#</title></head></html>';
const ERR_MSG = 'Error: This method is not yet supported by Fennec';

function LoaderWithHookedConsole() {
  let errors = [];
  let loader = Loader(module, {
    console: Object.create(console, {
      error: { value: function(error) {
        errors.push(error);
      }}
    })
  });

  return {
    loader: loader,
    errors: errors
  }
}

// TEST: tab unloader
exports.testAutomaticDestroy = function(test) {
  test.waitUntilDone();

  let called = false;

  let loader2 = Loader(module);
  let loader3 = Loader(module);
  let tabs2 = loader2.require('sdk/tabs');
  let tabs3 = loader3.require('sdk/tabs');
  let tabs2Len = tabs2.length;

  tabs2.on('open', function onOpen(tab) {
    test.fail("an onOpen listener was called that should not have been");
    called = true;
  });
  tabs2.on('ready', function onReady(tab) {
    test.fail("an onReady listener was called that should not have been");
    called = true;
  });
  tabs2.on('select', function onSelect(tab) {
    test.fail("an onSelect listener was called that should not have been");
    called = true;
  });
  tabs2.on('close', function onClose(tab) {
    test.fail("an onClose listener was called that should not have been");
    called = true;
  });
  loader2.unload();

  tabs3.on('open', function onOpen(tab) {
    test.pass("an onOpen listener was called for tabs3");

    tab.on('ready', function onReady(tab) {
      test.fail("an onReady listener was called that should not have been");
      called = true;
    });
    tab.on('select', function onSelect(tab) {
      test.fail("an onSelect listener was called that should not have been");
      called = true;
    });
    tab.on('close', function onClose(tab) {
      test.fail("an onClose listener was called that should not have been");
      called = true;
    });
  });
  tabs3.open(URL.replace(/#title#/, 'tabs3'));
  loader3.unload();

  // Fire a tab event and ensure that the destroyed tab is inactive
  tabs.once('open', function(tab) {
    test.pass('tabs.once("open") works!');

    test.assertEqual(tabs2Len, tabs2.length, "tabs2 length was not changed");
    test.assertEqual(tabs.length, (tabs2.length+2), "tabs.length > tabs2.length");

    tab.once('ready', function() {
      test.pass('tab.once("ready") works!');

      tab.once('close', function() {
        test.pass('tab.once("close") works!');

        timer.setTimeout(function () {
          test.assert(!called, "Unloaded tab module is destroyed and inactive");

          // end test
          test.done();
        });
      });

      tab.close();
    });
  });

  tabs.open('data:text/html;charset=utf-8,foo');
};

// TEST: tab properties
exports.testTabProperties = function(test) {
  test.waitUntilDone();
  let { loader, errors } = LoaderWithHookedConsole();
  let tabs = loader.require('sdk/tabs');

  let url = "data:text/html;charset=utf-8,<html><head><title>foo</title></head><body>foo</body></html>";
  let tabsLen = tabs.length;
  tabs.open({
    url: url,
    onReady: function(tab) {
      test.assertEqual(tab.title, "foo", "title of the new tab matches");
      test.assertEqual(tab.url, url, "URL of the new tab matches");
      test.assert(tab.favicon, "favicon of the new tab is not empty");
      // TODO: remove need for this test by implementing the favicon feature
      test.assertEqual(errors.length, 1, "favicon logs an error for now");
      test.assertEqual(tab.style, null, "style of the new tab matches");
      test.assertEqual(tab.index, tabsLen, "index of the new tab matches");
      test.assertNotEqual(tab.getThumbnail(), null, "thumbnail of the new tab matches");
      test.assertNotEqual(tab.id, null, "a tab object always has an id property");

      tab.close(function() {
        loader.unload();

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

  let url = "data:text/html;charset=utf-8,testTabsIteratorAndLength";
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

  let { loader, errors } = LoaderWithHookedConsole();
  let tabs = loader.require('sdk/tabs');

  let url = "data:text/html;charset=utf-8,testTabMove";

  tabs.open({
    url: url,
    onOpen: function(tab1) {
      test.assert(tab1.index >= 0, "opening a tab returns a tab w/ valid index");

      tabs.open({
        url: url,
        onOpen: function(tab) {
          let i = tab.index;
          test.assert(tab.index > tab1.index, "2nd tab has valid index");
          tab.index = 0;
          test.assertEqual(tab.index, i, "tab index after move matches");
          test.assertEqual(errors.length, 1, "setting tab.index logs error");

          // end test
          tab1.close(function() tab.close(function() {
            loader.unload();
            test.done();
          }));
        }
      });
    }
  });
};

// TEST: open tab with default options
exports.testTabsOpen_alt = function(test) {
  test.waitUntilDone();

  let { loader, errors } = LoaderWithHookedConsole();
  let tabs = loader.require('sdk/tabs');
  let url = "data:text/html;charset=utf-8,default";

  tabs.open({
    url: url,
    onReady: function(tab) {
      test.assertEqual(tab.url, url, "URL of the new tab matches");
      test.assertEqual(tabs.activeTab, tab, "URL of active tab in the current window matches");
      test.assertEqual(tab.isPinned, false, "The new tab is not pinned");
      test.assertEqual(errors.length, 1, "isPinned logs error");

      // end test
      tab.close(function() {
        loader.unload();
        test.done();
      });
    }
  });
};

// TEST: open pinned tab
exports.testOpenPinned_alt = function(test) {
    test.waitUntilDone();

    let { loader, errors } = LoaderWithHookedConsole();
    let tabs = loader.require('sdk/tabs');
    let url = "about:blank";

    tabs.open({
      url: url,
      isPinned: true,
      onOpen: function(tab) {
        test.assertEqual(tab.isPinned, false, "The new tab is pinned");
        test.assertEqual(errors.length, 2, "isPinned logs error");

        // end test
        tab.close(function() {
          loader.unload();
          test.done();
        });
      }
    });
};

// TEST: pin/unpin opened tab
exports.testPinUnpin_alt = function(test) {
    test.waitUntilDone();

    let { loader, errors } = LoaderWithHookedConsole();
    let tabs = loader.require('sdk/tabs');
    let url = "data:text/html;charset=utf-8,default";

    tabs.open({
      url: url,
      onOpen: function(tab) {
        tab.pin();
        test.assertEqual(tab.isPinned, false, "The tab was pinned correctly");
        test.assertEqual(errors.length, 2, "tab.pin() logs error");

        tab.unpin();
        test.assertEqual(tab.isPinned, false, "The tab was unpinned correctly");
        test.assertEqual(errors.length, 4, "tab.unpin() logs error");

        // end test
        tab.close(function() {
          loader.unload();
          test.done();
        });
      }
    });
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

  let url = URL.replace('#title#', 'testTabsEvent_onOpen');
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

// TEST: onReady event handler
exports.testTabsEvent_onReady = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,onready";
  let eventCount = 0;

  // add listener via property assignment
  function listener1(tab) {
    eventCount++;
  };
  tabs.on('ready', listener1);

  // add listener via collection add
  tabs.on('ready', function listener2(tab) {
    test.assertEqual(++eventCount, 2, "both listeners notified");
    tabs.removeListener('ready', listener1);
    tabs.removeListener('ready', listener2);

    // end test
    tab.close(function() test.done());
  });

  tabs.open(url);
};

// TEST: onActivate event handler
exports.testTabsEvent_onActivate = function(test) {
  test.waitUntilDone();

    let url = "data:text/html;charset=utf-8,onactivate";
    let eventCount = 0;

    // add listener via property assignment
    function listener1(tab) {
      eventCount++;
    };
    tabs.on('activate', listener1);

    // add listener via collection add
    tabs.on('activate', function listener2(tab) {
      test.assertEqual(++eventCount, 2, "both listeners notified");
      test.assertEqual(tab, tabs.activeTab, 'the active tab is correct');
      tabs.removeListener('activate', listener1);
      tabs.removeListener('activate', listener2);

      // end test
      tab.close(function() test.done());
    });

    tabs.open(url);
};

// TEST: onDeactivate event handler
exports.testTabsEvent_onDeactivate = function(test) {
  test.waitUntilDone();

  let url = "data:text/html;charset=utf-8,ondeactivate";
  let eventCount = 0;

  // add listener via property assignment
  function listener1(tab) {
    eventCount++;
  };
  tabs.on('deactivate', listener1);

  // add listener via collection add
  tabs.on('deactivate', function listener2(tab) {
    test.assertEqual(++eventCount, 2, 'both listeners notified');
    test.assertNotEqual(tab, tabs.activeTab, 'the active tab is not the deactivated tab');
    tabs.removeListener('deactivate', listener1);
    tabs.removeListener('deactivate', listener2);

    // end test
    tab.close(function() test.done());
  });

  tabs.on('activate', function onActivate(tab) {
    tabs.removeListener('activate', onActivate);
    tabs.open("data:text/html;charset=utf-8,foo");
    tab.close();
  });

  tabs.open(url);
};

// TEST: per-tab event handlers
exports.testPerTabEvents = function(test) {
  test.waitUntilDone();

  let eventCount = 0;

  tabs.open({
    url: "data:text/html;charset=utf-8,foo",
    onOpen: function(tab) {
      // add listener via property assignment
      function listener1() {
        eventCount++;
      };
      tab.on('ready', listener1);

      // add listener via collection add
      tab.on('ready', function listener2() {
        test.assertEqual(eventCount, 1, "both listeners notified");
        tab.removeListener('ready', listener1);
        tab.removeListener('ready', listener2);

        // end test
        tab.close(function() test.done());
      });
    }
  });
};

// TEST: tabs.activeTab getter
exports.testActiveTab_getter_alt = function(test) {
  test.waitUntilDone();

  let url = URL.replace("#title#", "foo");
  tabs.open({
    url: url,
    onActivate: function(tab) {
      test.assertEqual(tabs.activeTab.url, tab.url, 'the active tab is correct');

      tab.once('ready', function() {
        test.assertEqual(tab.url, url);
        test.assertEqual(tab.title, "foo");

        tab.close(function() {
          // end test
          test.done();
        });
      });
    }
  });
};

exports.testUniqueTabIds = function(test) {
  test.waitUntilDone();
  var tabs = require('sdk/tabs');
  var tabIds = {};
  var steps = [
    function (index) {
      tabs.open({
        url: "data:text/html;charset=utf-8,foo",
        onOpen: function(tab) {
          tabIds['tab1'] = tab.id;
          next(index);
        }
      });
    },
    function (index) {
      tabs.open({
        url: "data:text/html;charset=utf-8,bar",
        onOpen: function(tab) {
          tabIds['tab2'] = tab.id;
          next(index);
        }
      });
    },
    function (index) {
      test.assertNotEqual(tabIds.tab1, tabIds.tab2, "Tab ids should be unique.");
      test.done();
    }
  ];

  function next(index) {
    if (index === steps.length) {
      return;
    }
    let fn = steps[index];
    index++;
    fn(index);
  }

  next(0);
}
