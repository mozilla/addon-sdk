/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Sidebar } = require('sdk/ui/sidebar');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

exports.testSidebarBasic = function(assert) {
  assert.ok(!getMostRecentBrowserWindow().document.getElementById('test'), 'sidebar id DNE');
  let sidebarXUL = getMostRecentBrowserWindow().document.getElementById('sidebar');
  assert.ok(sidebarXUL, 'sidebar xul element does exist');
  //assert.notEqual(sidebarXUL.getAttribute(''))
  let sidebar = Sidebar({
    id: 'test',
    label: 'test',
    url: 'http://mozilla.org'
  });
  assert.pass('The Sidebar constructor worked');
  let ele = getMostRecentBrowserWindow().document.getElementById('test');
  assert.ok(ele, 'sidebar element was added');
  assert.ok(!ele.hasAttribute('checked'), 'the sidebar is not displayed');
  sidebar.show();
  assert.equal(ele.getAttribute('checked'), 'true', 'the sidebar is displayed');
  sidebar.destroy();
  assert.ok(!getMostRecentBrowserWindow().document.getElementById('test'), 'sidebar id DNE');
  assert.pass('calling destroy worked without error');
}

require('sdk/test').run(exports);
