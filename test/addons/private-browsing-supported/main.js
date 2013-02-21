/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Ci } = require('chrome');
const { isPrivateBrowsingSupported } = require('sdk/self');
const tabs = require('sdk/tabs');
const { browserWindows: windows } = require('sdk/windows');
const { isPrivate } = require('sdk/private-browsing');
const { getOwnerWindow } = require('sdk/private-browsing/window/utils');
const { is } = require('sdk/system/xul-app');
const { isWindowPBSupported, isTabPBSupported } = require('sdk/private-browsing/utils');

exports.testIsPrivateBrowsingTrue = function(assert) {
  assert.ok(isPrivateBrowsingSupported,
            'isPrivateBrowsingSupported property is true');
};

// test tab.open with isPrivate: true
// test isPrivate on a tab
// test getOwnerWindow on windows and tabs
exports.testGetOwnerWindow = function(assert, done) {
  let window = windows.activeWindow;
  let chromeWindow = getOwnerWindow(window);
  assert.ok(chromeWindow instanceof Ci.nsIDOMWindow, 'associated window is found');

  tabs.open({
    url: 'about:blank',
    isPrivate: true,
    onOpen: function(tab) {
      // test that getOwnerWindow works as expected
      if (is('Fennec')) {
        assert.notStrictEqual(chromeWindow, getOwnerWindow(tab)); 
        assert.ok(getOwnerWindow(tab) instanceof Ci.nsIDOMWindow); 
      }
      else {
        if (isWindowPBSupported) {
          assert.notStrictEqual(chromeWindow,
          	                    getOwnerWindow(tab),
          	                    'associated window is not the same for window and window\'s tab'); 
        }
        else {
          assert.strictEqual(chromeWindow,
          	                 getOwnerWindow(tab),
          	                 'associated window is the same for window and window\'s tab');
        }
      }

      let pbSupported = isTabPBSupported || isWindowPBSupported;

      // test that the tab is private if it should be
      assert.equal(isPrivate(tab), pbSupported);
      assert.equal(isPrivate(getOwnerWindow(tab)), pbSupported);

      tab.close(function() done());
    }
  });
};

// test windows.open with isPrivate: true
// test isPrivate on a window
if (!is('Fennec')) {
  exports.testIsPrivateOnWindowOn = function(assert, done) {
    windows.open({
      isPrivate: true,
      onOpen: function(window) {
        assert.equal(isPrivate(window), isWindowPBSupported, 'isPrivate for a window is true when it should be');
        assert.equal(isPrivate(window.tabs[0]), isWindowPBSupported, 'isPrivate for a tab is false when it should be');
        window.close(done);
      }
    });
  };

  exports.testIsPrivateOnWindowOffImplicit = function(assert, done) {
    windows.open({
      onOpen: function(window) {
        assert.equal(isPrivate(window), false, 'isPrivate for a window is false when it should be');
        assert.equal(isPrivate(window.tabs[0]), false, 'isPrivate for a tab is false when it should be');
        window.close(done);
      }
    })
  }

  exports.testIsPrivateOnWindowOffExplicit = function(assert, done) {
    windows.open({
      isPrivate: false,
      onOpen: function(window) {
        assert.equal(isPrivate(window), false, 'isPrivate for a window is false when it should be');
        assert.equal(isPrivate(window.tabs[0]), false, 'isPrivate for a tab is false when it should be');
        window.close(done);
      }
    })
  }
}

require('sdk/test/runner').runTestsFromModule(module);
