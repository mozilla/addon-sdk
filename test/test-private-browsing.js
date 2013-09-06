/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Ci } = require('chrome');
const { merge } = require('sdk/util/object');
const windows = require('sdk/windows').browserWindows;
const tabs = require('sdk/tabs');
const winUtils = require('sdk/window/utils');
const { isWindowPrivate } = winUtils;
const { isPrivateBrowsingSupported } = require('sdk/self');
const { is } = require('sdk/system/xul-app');
const { isPrivate } = require('sdk/private-browsing');
const { getOwnerWindow } = require('sdk/private-browsing/window/utils');
const { LoaderWithHookedConsole } = require("sdk/test/loader");
const { getMode, isGlobalPBSupported,
        isWindowPBSupported, isTabPBSupported } = require('sdk/private-browsing/utils');
const { pb } = require('./private-browsing/helper');
const prefs = require('sdk/preferences/service');
const { set: setPref } = require("sdk/preferences/service");
const DEPRECATE_PREF = "devtools.errorconsole.deprecation_warnings";

const kAutoStartPref = "browser.privatebrowsing.autostart";

// is global pb is enabled?
if (isGlobalPBSupported) {
  merge(module.exports, require('./private-browsing/global'));

  exports.testGlobalOnlyOnFirefox = function(test) {
    test.assert(is("Firefox"), "isGlobalPBSupported is only true on Firefox");
  }
}
else if (isWindowPBSupported) {
  merge(module.exports, require('./private-browsing/windows'));

  exports.testPWOnlyOnFirefox = function(test) {
    test.assert(is("Firefox"), "isWindowPBSupported is only true on Firefox");
  }
}
// only on Fennec
else if (isTabPBSupported) {
  merge(module.exports, require('./private-browsing/tabs'));

  exports.testPTOnlyOnFennec = function(test) {
    test.assert(is("Fennec"), "isTabPBSupported is only true on Fennec");
  }
}

exports.testIsPrivateDefaults = function(test) {
  test.assertEqual(isPrivate(), false, 'undefined is not private');
  test.assertEqual(isPrivate('test'), false, 'strings are not private');
  test.assertEqual(isPrivate({}), false, 'random objects are not private');
  test.assertEqual(isPrivate(4), false, 'numbers are not private');
  test.assertEqual(isPrivate(/abc/), false, 'regex are not private');
  test.assertEqual(isPrivate(function() {}), false, 'functions are not private');
};

exports.testWindowDefaults = function(test) {
  setPref(DEPRECATE_PREF, true);
  // Ensure that browserWindow still works while being deprecated
  let { loader, messages } = LoaderWithHookedConsole(module);
  let windows = loader.require("sdk/windows").browserWindows;
  test.assertEqual(windows.activeWindow.isPrivateBrowsing, false,
                   'window is not private browsing by default');
  test.assertMatches(messages[0].msg, /DEPRECATED.+isPrivateBrowsing/,
                     'isPrivateBrowsing is deprecated');

  let chromeWin = winUtils.getMostRecentBrowserWindow();
  test.assertEqual(getMode(chromeWin), false);
  test.assertEqual(isWindowPrivate(chromeWin), false);
}

// tests for the case where private browsing doesn't exist
exports.testIsActiveDefault = function(test) {
  test.assertEqual(pb.isActive, false,
                   'pb.isActive returns false when private browsing isn\'t supported');
};

exports.testIsPrivateBrowsingFalseDefault = function(test) {
  test.assertEqual(isPrivateBrowsingSupported, false,
  	               'isPrivateBrowsingSupported property is false by default');
};

exports.testGetOwnerWindow = function(test) {
  test.waitUntilDone();

  let window = windows.activeWindow;
  let chromeWindow = getOwnerWindow(window);
  test.assert(chromeWindow instanceof Ci.nsIDOMWindow, 'associated window is found');

  tabs.open({
    url: 'about:blank',
    isPrivate: true,
    onOpen: function(tab) {
      // test that getOwnerWindow works as expected
      if (is('Fennec')) {
        test.assertNotStrictEqual(chromeWindow, getOwnerWindow(tab)); 
        test.assert(getOwnerWindow(tab) instanceof Ci.nsIDOMWindow); 
      }
      else {
        test.assertStrictEqual(chromeWindow, getOwnerWindow(tab), 'associated window is the same for window and window\'s tab');
      }

      // test that the tab is not private
      // private flag should be ignored by default
      test.assert(!isPrivate(tab));
      test.assert(!isPrivate(getOwnerWindow(tab)));

      tab.close(function() test.done());
    }
  });
};

exports.testNewGlobalPBService = function(test) {
  test.assertEqual(isPrivate(), false, 'isPrivate() is false by default');
  prefs.set(kAutoStartPref, true);
  test.assertEqual(prefs.get(kAutoStartPref, false), true, kAutoStartPref + ' is true now');
  test.assertEqual(isPrivate(), true, 'isPrivate() is true now');
  prefs.set(kAutoStartPref, false);
  test.assertEqual(isPrivate(), false, 'isPrivate() is false again');
}
