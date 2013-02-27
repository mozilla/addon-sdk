const { Ci } = require("chrome");
const tabBrowser = require("sdk/deprecated/tab-browser");
const pbUtils = require('sdk/private-browsing/utils');
const { isPrivate }  = require('sdk/private-browsing');
const { getOwnerWindow } = require('sdk/private-browsing/window/utils');

exports.testActiveTabIsThePrivateTab = function(assert, done) {
  let { browserWindows } = require('sdk/windows');
  let pbWindowUtils = require('sdk/deprecated/window-utils');

  let startActiveTab = tabBrowser.activeTab;
  // make a new private window
  browserWindows.open({
    isPrivate: true,
    onOpen: function(win) {
      let window = getOwnerWindow(win);
      assert.ok(window instanceof Ci.nsIDOMWindow, "window was found");

      assert.notEqual(tabBrowser.activeTab, startActiveTab,
                     "active tab has changed");
      assert.equal(tabBrowser.activeTab.ownerDocument.defaultView, window,
                   "The activeTab is from the newly opened window");

      // PWPB case
      if (pbUtils.isWindowPBSupported) {
        assert.ok(pbUtils.isWindowPrivate(window), "window is private");
        assert.notEqual(tabBrowser.activeTab, startActiveTab,
                        "active tab changed to the private tab");
        assert.ok(isPrivate(tabBrowser.activeTab.linkedBrowser.contentWindow),
                  "The activeTab refers to a private tab");
      }

      win.close(done);
    }
  });
};

exports.testTrackerListPrivateTab = function(assert, done) {
  let { browserWindows } = require('sdk/windows');
  let pbWindowUtils = require('sdk/deprecated/window-utils');

  let tracker = tabBrowser.Tracker();
  // make a new private window
  browserWindows.open({
    isPrivate: true,
    onOpen: function(win) {
      let window = getOwnerWindow(win);
      assert.ok(window instanceof Ci.nsIDOMWindow, "window was found");

      // Get the last opened browser that should be the one for the new window tab
      let browser = tracker.get(tracker.length-1);
      assert.equal(browser.ownerDocument.defaultView, window,
                   "The browser is from the new window");

      if (pbUtils.isWindowPBSupported) {
        assert.ok(isPrivate(browser.contentWindow),
                  "The browser is for a private tab");
      }
      win.close(done);
    }
  });
};
