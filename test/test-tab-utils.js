'use strict';

const { LoaderWithHookedConsole } = require('sdk/test/loader');
const { getTabs } = require('sdk/tab/utils');
const { isWindowPBSupported, isTabPBSupported } = require('sdk/private-browsing/utils');
const { browserWindows } = require('sdk/windows');
const tabs = require('sdk/tabs');
const { isPrivate } = require('sdk/private-browsing');
const { openTab, closeTab, getTabContentWindow, getOwnerWindow } = require('sdk/tab/utils');
const { open, close } = require('sdk/window/helpers');
const { windows } = require('sdk/window/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { set: setPref, get: getPref } = require('sdk/preferences/service');
const { fromIterator } = require('sdk/util/array');

const DEPRECATE_PREF = 'devtools.errorconsole.deprecation_warnings';

if (isWindowPBSupported) {
  exports.testGetTabs = function(assert, done) {
    let tabCount = getTabs().length;
    let windowCount = browserWindows.length;

    open(null, {
        features: {
        private: true,
        toolbar: true,
        chrome: true
      }
    }).then(function(window) {
      assert.ok(isPrivate(window), 'new tab is private');

      assert.equal(getTabs().length, tabCount, 'there are no new tabs found');
      getTabs().forEach(function(tab) {
        assert.equal(isPrivate(tab), false, 'all found tabs are not private');
        assert.equal(isPrivate(getOwnerWindow(tab)), false, 'all found tabs are not private');
        assert.equal(isPrivate(getTabContentWindow(tab)), false, 'all found tabs are not private');
      });

      assert.equal(browserWindows.length, windowCount, 'there are no new windows found');
      fromIterator(browserWindows).forEach(function(window) {
        assert.equal(isPrivate(window), false, 'all found windows are not private');
      });

      assert.equal(windows(null, {includePrivate: true}).length, 2, 'there are really two windows');

      close(window).then(done);
    });
  };
}
else if (isTabPBSupported) {
  exports.testGetTabs = function(assert, done) {
    let startTabCount = getTabs().length;
    let tab = openTab(getMostRecentBrowserWindow(), 'about:blank', {
      isPrivate: true
    });

    assert.ok(isPrivate(getTabContentWindow(tab)), 'new tab is private');
    let utils_tabs = getTabs();
    assert.equal(utils_tabs.length, startTabCount + 1,
                 'there are two tabs found');
    assert.equal(utils_tabs[utils_tabs.length-1], tab,
                 'the last tab is the opened tab');
    assert.equal(browserWindows.length, 1, 'there is only one window');
    closeTab(tab);

    done();
  };
}

exports['test sdk/tabs/utils deprecration message'] = function(assert) {
  let oldPrefValue = getPref(DEPRECATE_PREF, false);
  setPref(DEPRECATE_PREF, true);

  let { loader, messages } = LoaderWithHookedConsole();
  let tabs = loader.require('sdk/tabs/utils');
  let msg = new RegExp("DEPRECATED: Module 'sdk/tabs/utils' is deprecated use 'sdk/tab/utils' instead");

  // TODO: remove need for this test by implementing the favicon feature
  assert.ok(
    msg.test(messages[0].msg),
    "sdk/tabs/utils throws a deprecation message");
  assert.equal(messages.length, 1, "the length is one");

  let tab = loader.require('sdk/tab/utils');
  assert.equal(messages.length, 1, "the length is still one");

  assert.equal(Object.keys(tabs).join(""), Object.keys(tab).join(""), "the keys are the same");

  assert.deepEqual(tabs.getTabId, tab.getTabId, "getTabId is the same");

  loader.unload();

  setPref(DEPRECATE_PREF, oldPrefValue);
}

require('sdk/test').run(exports);
