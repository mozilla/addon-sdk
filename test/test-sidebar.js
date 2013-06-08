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
const { makeID } = require('sdk/ui/sidebar/utils');

exports.testSidebarBasicLifeCycle = function(assert, done) {
  let testName = 'test';
  assert.ok(!getMostRecentBrowserWindow().document.getElementById(makeID(testName)), 'sidebar id DNE');
  let sidebarXUL = getMostRecentBrowserWindow().document.getElementById('sidebar');
  assert.ok(sidebarXUL, 'sidebar xul element does exist');
  //assert.notEqual(sidebarXUL.getAttribute(''))
  let sidebar = Sidebar({
    id: testName,
    label: 'test',
    url: 'about:blank'
  });

  assert.pass('The Sidebar constructor worked');
  let ele = getMostRecentBrowserWindow().document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');
  assert.ok(!ele.hasAttribute('checked'), 'the sidebar is not displayed');

  sidebar.on('show', function() {
    assert.pass('the show event was fired');
    assert.equal(isShowing(sidebar), true, 'the sidebar is showing');
    assert.equal(ele.getAttribute('checked'), 'true', 'the sidebar is displayed');

    sidebar.once('hide', function() {
      assert.pass('the hide event was fired');
      assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');

      sidebar.destroy();
      assert.ok(!getMostRecentBrowserWindow().document.getElementById(makeID(testName)), 'sidebar id DNE');
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
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  open().then(function(window) {
      let ele = window.document.getElementById(makeID(testName));
      assert.ok(ele, 'sidebar element was added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

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
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  open(null, { features: { private: true } }).then(function(window) {
      let ele = window.document.getElementById(makeID(testName));
      assert.ok(isPrivate(window), 'the new window is private');
      assert.equal(ele, null, 'sidebar element was not added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

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
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  let oldEle = ele;
  sidebar.once('show', function() {
    assert.pass('show event fired');

    sidebar.once('attach', function() {
      assert.pass('attach event fired');

      sidebar.once('show', function() {
        let window = getMostRecentBrowserWindow();
        assert.notEqual(startWindow, window, 'window is new');

        let sb = window.document.getElementById('sidebar');
        if (sb && sb.docShell && sb.contentDocument && sb.contentDocument.getElementById('web-panels-browser')) {
          end();
        }
        else {
          sb.addEventListener('DOMWindowCreated', end, false);console.log(2)
        }

        function end() {
          sb.removeEventListener('DOMWindowCreated', end, false);
          let webPanelBrowser = sb.contentDocument.getElementById('web-panels-browser');

          let ele = window.document.getElementById(makeID(testName));

          assert.ok(ele, 'sidebar element was added 2');
          assert.equal(ele.hasAttribute('checked'), true, 'the sidebar is checked');
          assert.notEqual(ele, oldEle, 'there are two different sidebars');

          assert.equal(isShowing(sidebar), true, 'the sidebar is showing in new window');

          webPanelBrowser.contentWindow.addEventListener('load', function onload() {
            webPanelBrowser.contentWindow.addEventListener('load', onload, false);

            sidebar.destroy();

            assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
            assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
            assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

            setTimeout(function() {
              close(window).then(done, assert.fail);
            });
          }, false);
        }
      });

      startWindow.OpenBrowserWindow();
    });
  });

  show(sidebar);
  assert.pass('showing the sidebar');
}

exports.testAddonGlobal = function(assert, done) {
  let testName = 'testAddonGlobal';
  let sidebar = Sidebar({
    id: testName,
    label: testName,
    url: data.url('test-sidebar-addon-global.html')
  });

  sidebar.on('attach', function(worker) {
    assert.pass('sidebar was attached');
    assert.ok(!!worker, 'attach event has worker');

    worker.port.once('X', function(msg) {
      assert.equal(msg, '1', 'got event from worker');

      worker.port.on('X', function(msg) {
        assert.equal(msg, '123', 'the final message is correct');

        sidebar.destroy();

        done();
      });
      worker.port.emit('X', msg + '2');
    })
  });
  show(sidebar);
}

require('sdk/test').run(exports);
