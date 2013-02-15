/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Ci } = require('chrome');
const { pb, pbUtils, getOwnerWindow } = require('./private-browsing/helper');
const { merge } = require('sdk/util/object');
const windows = require('sdk/windows').browserWindows;
const winUtils = require('sdk/window/utils');

// is global pb is enabled?
if (pbUtils.isGlobalPBSupported) {
  merge(module.exports, require('./private-browsing/global'));
}
else if (pbUtils.isWindowPBSupported) {
  merge(module.exports, require('./private-browsing/windows'));
}

exports.testIsPrivateDefaults = function(test) {
  test.assertEqual(pb.isPrivate(), false, 'undefined is not private');
  test.assertEqual(pb.isPrivate('test'), false, 'strings are not private');
  test.assertEqual(pb.isPrivate({}), false, 'random objects are not private');
  test.assertEqual(pb.isPrivate(4), false, 'numbers are not private');
  test.assertEqual(pb.isPrivate(/abc/), false, 'regex are not private');
  test.assertEqual(pb.isPrivate(function() {}), false, 'functions are not private');
};

exports.testWindowDefaults = function(test) {
  test.assertEqual(windows.activeWindow.isPrivateBrowsing, false, 'window is not private browsing by default');
  let chromeWin = winUtils.getMostRecentBrowserWindow();
  test.assertEqual(pbUtils.getMode(chromeWin), false);
  test.assertEqual(pbUtils.isWindowPrivate(chromeWin), false);
}

// tests for the case where private browsing doesn't exist
exports.testIsActiveDefault = function(test) {
  test.assertEqual(pb.isActive, false,
                   'pb.isActive returns false when private browsing isn\'t supported');
};

exports.testGetOwnerWindow = function(test) {
  let window = windows.activeWindow;
  let chromeWindow = getOwnerWindow(window);
  test.assertEqual(chromeWindow instanceof Ci.nsIDOMWindow, true, 'associated window is found');
  test.assertEqual(chromeWindow, getOwnerWindow(window.tabs[0]), 'associated window is the same for window and window\'s tab');
}
