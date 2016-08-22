/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'engines': {
    'Firefox': '*',
    'Fennec': '*'
  }
};

const { isBrowser, getMostRecentBrowserWindow, windows, isWindowPrivate } = require('sdk/window/utils');
const { Menuitem, FILE_MENU, APP_MENU } = require('sdk/ui/menuitem');
const { open, close, focus, promise: windowPromise } = require('sdk/window/helpers');
const { identify } = require('sdk/ui/id');
const app = require('sdk/system/xul-app');
const { emit } = require('sdk/system/events');


exports.testMenuitemBasic = function(assert, done) {
  let testName = 'testMenuitemBasic';
  let mi = Menuitem({
    label: testName,
    menu: [ APP_MENU, FILE_MENU ],
    onClick: function() {
      assert.pass('click');
      mi.destroy();

      assert.ok(!getMostRecentBrowserWindow().document.getElementById(identify(mi)), 'the Menuitem id is not a valid element');
      done();
    }
  });

  assert.equal(mi.label, testName, 'the Menuitem.label is as expected');
  assert.ok(identify(mi), 'the Menuitem id is truthy');
  assert.ok(!mi.disabled, 'the Menuitem.disabled is falsey');

  if (app.is('Fennec')) {
    emit('Menu:Clicked', { data: identify(mi) });
  }
  else {
    let ele = getMostRecentBrowserWindow().document.getElementById(identify(mi));
    assert.ok(ele, 'the Menuitem id is a valid element');
    assert.ok(!ele.disabled, 'the Menuitem ele is not disabled');
    ele.click();
  }
}

exports.testMenuitemNewWindow = function(assert, done) {
  let testName = 'testMenuitemNewWindow';
  let mi = Menuitem({
    label: testName,
    menu: [ APP_MENU, FILE_MENU ]
  });

  assert.equal(mi.label, testName, 'the Menuitem.label is as expected');
  assert.ok(identify(mi), 'the Menuitem id is truthy');
  assert.ok(!mi.disabled, 'the Menuitem.disabled is falsey');

  if (app.is('Fennec')) {
    return done();
  }

  let ele = getMostRecentBrowserWindow().document.getElementById(identify(mi));
  assert.ok(ele, 'the Menuitem id is a valid element');

  open().then(focus).then(function(window) {
    let ele = getMostRecentBrowserWindow().document.getElementById(identify(mi));
    assert.ok(ele, 'the Menuitem id is a valid element');
    mi.once('click', function() {
      assert.pass('click');
      mi.destroy();
      assert.ok(!getMostRecentBrowserWindow().document.getElementById(identify(mi)), 'the Menuitem id is not a valid element');

      close(window).then(done, assert.fail);
    });
    assert.ok(!ele.disabled, 'the Menuitem ele is not disabled');
    ele.click();
  });
}

exports.testInvalidLabel = function(assert) {
  let testName = 'testInvalidLabel';

  assert.throws(function() {
    Menuitem({
      menu: [ FILE_MENU ]
    }).destroy();
  }, /The option "label" must be/i, 'missing label option is not ok');
}

exports.testInvalidDisabled = function(assert) {
  let testName = 'testInvalidDisabled';

  assert.throws(function() {
    Menuitem({
      label: testName,
      disabled: 'true',
      menu: [ FILE_MENU ]
    }).destroy();
  }, /The option "disabled" must be/i, 'string disabled option is not ok');
}

exports.testInvalidMenu = function(assert) {
  let testName = 'testMissingMenu';

  assert.throws(function() {
    Menuitem({
      label: testName
    }).destroy();
  }, /The option "menu" must be an array with some MENU/i, 'missing menu option is not ok');

  assert.throws(function() {
    Menuitem({
      label: testName,
      menu: []
    }).destroy();
  }, /The option "menu" must be an array with some MENU/i, 'missing menu option is not ok');

  assert.throws(function() {
    Menuitem({
      label: testName,
      menu: [ 1 ]
    }).destroy();
  }, /No valid menu was found./i, 'invalid menu option is not ok');
}

exports.testSetLabel = function(assert) {
  let testName = 'testSetLabel';

  let menuitem = Menuitem({
    label: testName,
    menu: [ APP_MENU, FILE_MENU ]
  });

  assert.equal(menuitem.label, testName, 'menuitem label is ' + testName);

  menuitem.label = testName + 2;

  assert.equal(menuitem.label, testName + 2, 'menuitem label is ' + testName + 2);

  menuitem.destroy();
}

exports.testSetDisabled = function(assert) {
  let testName = 'testSetDisabled';

  let menuitem = Menuitem({
    label: testName,
    menu: [ APP_MENU, FILE_MENU ]
  });

  assert.equal(menuitem.disabled, false, 'menuitem is not disabled');

  menuitem.disabled = true;

  assert.equal(menuitem.disabled, true, 'menuitem is disabled');

  menuitem.destroy();
}

require('sdk/test').run(exports);
