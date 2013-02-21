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
          assert.notStrictEqual(chromeWindow, getOwnerWindow(tab), 'associated window is not the same for window and window\'s tab'); 
        }
        else {
          assert.strictEqual(chromeWindow, getOwnerWindow(tab), 'associated window is the same for window and window\'s tab');
        }
      }

      if (isTabPBSupported || isWindowPBSupported) {
        // test that the tab is not private
        // private flag should be ignored by default
        assert.ok(isPrivate(tab));
        assert.ok(isPrivate(getOwnerWindow(tab)));
      }

      tab.close(function() done());
    }
  });
};

require('sdk/test/runner').runTestsFromModule(module);
