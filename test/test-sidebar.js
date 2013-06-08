/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Sidebar } = require('sdk/ui/sidebar');
const { show, hide } = require('sdk/ui/actions');
const { isShowing } = require('sdk/ui/state');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { open, close, focus, promise: windowPromise } = require('sdk/window/helpers');
const { setTimeout } = require('sdk/timers');
const { isPrivate } = require('sdk/private-browsing');
const { data } = require('sdk/self');

exports.testSidebarBasicLifeCycle = function(assert, done) {
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

  sidebar.on('show', function({ target }) {
    assert.pass('the show event was fired');
    assert.equal(isShowing(sidebar), true, 'the sidebar is showing');
    assert.equal(target, sidebar, 'the target is the sidebar');
    assert.equal(ele.getAttribute('checked'), 'true', 'the sidebar is displayed');

    sidebar.once('hide', function({ target }) {
      assert.pass('the hide event was fired');
      assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
      assert.equal(target, sidebar, 'the target is the sidebar');

      sidebar.destroy();
      assert.ok(!getMostRecentBrowserWindow().document.getElementById('test'), 'sidebar id DNE');
      assert.pass('calling destroy worked without error');

      done();
    });
    hide(sidebar);
    assert.pass('hiding sidebar..');
  });
  show(sidebar);
  assert.pass('showing sidebar..');
}

exports.testSideBarIsInNewWindows = function(assert, done) {
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
      let ele = window.document.getElementById(testName);
      assert.ok(ele, 'sidebar element was added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(testName), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(testName), 'sidebar id DNE');

      close(window).then(done, assert.fail);
  })
}

exports.testSideBarIsNotInNewPrivateWindows = function(assert, done) {
  let testName = 'testSideBarOnNewWindow';
  let sidebar = Sidebar({
    id: testName,
    label: testName,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(testName);
  assert.ok(ele, 'sidebar element was added');

  open(null, { features: { private: true } }).then(function(window) {
      let ele = window.document.getElementById(testName);
      assert.ok(isPrivate(window), 'the new window is private');
      assert.equal(ele, null, 'sidebar element was not added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(testName), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(testName), 'sidebar id DNE');

      close(window).then(done, assert.fail);
  })
}

exports.testSideBarIsShowingInNewWindows = function(assert, done) {
  let testName = 'testSideBarIsShowingInNewWindows';
  let sidebar = Sidebar({
    id: testName,
    label: testName,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(testName);
  assert.ok(ele, 'sidebar element was added');

  let oldEle = ele;
  sidebar.once('show', function() {
    sidebar.once('attach', function() {
      promise.then(function(window) {
        let ele = window.document.getElementById(testName);
        assert.ok(ele, 'sidebar element was added');
        assert.equal(ele.hasAttribute('checked'), true, 'the sidebar is checked');
        assert.notEqual(ele, oldEle, 'there are two different sidebars');

          assert.equal(isShowing(sidebar), true, 'the sidebar is showing in new window');
          sidebar.destroy();

          assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
          assert.ok(!window.document.getElementById(testName), 'sidebar id DNE');
          assert.ok(!startWindow.document.getElementById(testName), 'sidebar id DNE');

          close(window).then(done, assert.fail);
      });
    });
    let promise = windowPromise(startWindow.OpenBrowserWindow(), 'load').then(focus);
  });
  show(sidebar);
}

exports.testAddonGlobal = function(assert, done) {
  let testName = 'testAddonGlobal';
  let sidebar = Sidebar({
    id: testName,
    label: testName,
    url: data.url('test-sidebar-addon-global.html')
  });

  sidebar.on('show', function({ worker }) {
    worker.on('message', function(msg) {
      assert.equal(msg, 'hello sidebar add-on');
      sidebar.destroy();
      done();
    })
    worker.postMessage();
  });
  show(sidebar);
}

require('sdk/test').run(exports);
