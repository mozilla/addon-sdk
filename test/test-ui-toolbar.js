/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'engines': {
    'Firefox': '*'
  }
};

const { Toolbar } = require('sdk/ui/toolbar');
const { Loader } = require('sdk/test/loader');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

exports.testWorker = function(assert, done) {
  let testName = 'testWorker';
  let toolbar = Toolbar({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,<html><body><script>addon.port.emit("TEST");</script></body></html>',
    onAttach: function(worker) {
      assert.pass('on attach');

      worker.port.once('TEST', function() {
        assert.pass('message was passed from the toolbar worker');
        toolbar.destroy();
        done();
      });
    }
  });
}

exports.testUnload = function(assert, done) {
  let loader = Loader(module);
  let { Toolbar } = loader.require('sdk/ui/toolbar');
  let testName = 'testUnload';

  let toolbar = Toolbar({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,'+ testName,
    onAttach: function(worker) {
      assert.pass('on attach');
      loader.unload();
    },
    onDestroy: function() {
      done();
    }
  });
}

exports.testDestroy = function(assert, done) {
  let testName = 'testDestroy';

  let toolbar = Toolbar({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,' + testName,
    onAttach: function(worker) {
      assert.pass('on attach');
      this.destroy();
    },
    onDestroy: function() {
      done();
    }
  });
}

exports.testChangeTitle = function(assert, done) {
  let testName = 'testChangeTitle';

  let toolbar = Toolbar({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,' + testName,
    onAttach: function(worker) {
      assert.pass('on attach');
      assert.equal(this.title, testName, 'title is ' + testName);
      this.title = '5';
      assert.equal(this.title, '5', 'title is 5');
      this.hide();
    },
    onHide: function() {
      assert.pass('on hide');
      assert.equal(this.title, '5', 'title is 5');
      this.destroy();
      done();
    }
  });
}

exports.testCloseButton = function(assert, done) {
  let testName = 'testCloseButton';

  let toolbar = Toolbar({
    id: testName,
    title: testName,
    url: 'data:text/html;charset=utf-8,' + testName,
    onShow: function() {
      let window = getMostRecentBrowserWindow();
      let toolbarEle = window.document.getElementById(this.id);

      assert.ok(toolbarEle, 'toolbar exists');

      let closeBtn = toolbarEle.lastChild;

      assert.ok(closeBtn, 'there is a close button found');
      closeBtn.click();
    },
    onHide: function() {
      assert.pass('on hide');
      this.destroy();
      done();
    }
  });
  toolbar.show();
};

require('sdk/test').run(exports);
