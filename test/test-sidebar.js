/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Sidebar } = require('sdk/ui/sidebar');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { open, close, focus } = require('sdk/window/helpers');
const { setTimeout } = require('sdk/timers');


exports.testSidebarBasic = function(assert) {
  assert.ok(!getMostRecentBrowserWindow().document.getElementById('test'), 'sidebar id DNE');
  let sidebarXUL = getMostRecentBrowserWindow().document.getElementById('sidebar');
  assert.ok(sidebarXUL, 'sidebar xul element does exist');
  //assert.notEqual(sidebarXUL.getAttribute(''))
  let sidebar = Sidebar({
    id: 'test',
    label: 'test',
    url: 'about:blank'
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

exports.testSideBarOnNewWindow = function(assert, done) {
  let testName = 'testSideBarOnNewWindow';
  let sidebar = Sidebar({
    id: testName,
    label: testName,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(testName);
  assert.ok(ele, 'sidebar element was added');

  open().then(function(window) {
    setTimeout(function() {
    let ele = window.document.getElementById(testName);
    assert.ok(ele, 'sidebar element was added');

    sidebar.destroy();
    assert.ok(!window.document.getElementById(testName), 'sidebar id DNE');
    assert.ok(!startWindow.document.getElementById(testName), 'sidebar id DNE');

    close(window).then(done, assert.fail);
    });
  })
}

require('sdk/test').run(exports);
