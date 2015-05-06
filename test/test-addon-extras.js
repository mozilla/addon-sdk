/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Ci, Cu, Cc, components } = require("chrome");
const extras = require("sdk/addon/extras");
const self = require("sdk/self");
const { before, after } = require("sdk/test/utils");
const fixtures = require("./fixtures");
const { Loader } = require("sdk/test/loader");
const { merge } = require("sdk/util/object");

exports["test changing result from addon extras in panel"] = function(assert, done) {
  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });

  const { Panel } = loader.require('sdk/panel');
  const extras = loader.require("sdk/addon/extras");

  var result = 1;
  extras.set({
    test: function() {
      return result;
    }
  });

  let panel = Panel({
    contentURL: "./test-addon-extras.html"
  });

  panel.port.once("result1", (result) => {
    assert.equal(result, 1, "result is a number");
    result = true;
    panel.port.emit("get-result");
  });

  panel.port.once("result2", (result) => {
    assert.equal(result, true, "result is a boolean");
    loader.unload();
    done();
  });

  panel.port.emit("get-result");
}

exports["test window result from addon extras in panel"] = function*(assert) {
  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });

  const { Panel } = loader.require('sdk/panel');
  const { Page } = loader.require('sdk/page-worker');
  const extras = loader.require("sdk/addon/extras");
  const { getActiveView } = loader.require("sdk/view/core");
  const { getDocShell } = loader.require('sdk/frame/utils');
  var page;

  extras.set({
    test: function(window) {
      return getActiveView(page).contentWindow.wrappedJSObject;
    }
  });

  let panel = Panel({
    contentURL: "./test-addon-extras-window.html"
  });

  // make a page worker and wait for it to load
  page = yield new Promise(resolve => {
    let page = Page({
      contentURL: "./test.html",
      contentScriptWhen: "end",
      contentScript: "self.port.emit('end')"
    });
    page.port.once("end", () => resolve(page));
  });

  // make a page worker and wait for it to load
  yield new Promise(resolve => {
    panel.port.once("result1", (result) => {
      assert.equal(result, fixtures.url("./test.html"), "result1 is a window");
      resolve();
    });

    assert.pass("emit get-result");
    panel.port.emit("get-result");
  });

  page.destroy();

  page = yield new Promise(resolve => {
    let page = Page({
      contentURL: "./index.html",
      contentScriptWhen: "end",
      contentScript: "self.port.emit('end')"
    });
    page.port.once("end", () => resolve(page));
  });

  yield new Promise(resolve => {
    panel.port.once("result2", (result) => {
      assert.equal(result, fixtures.url("./index.html"), "result2 is a window");
      resolve();
    });

    assert.pass("emit get-result");
    panel.port.emit("get-result");
  });

  loader.unload();
}

exports["test addon extras are not added to non-addon data: uris in panels"] = function(assert, done) {
  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });

  const { Panel } = loader.require('sdk/panel');
  const extras = loader.require("sdk/addon/extras");

  var result = 1;
  extras.set({
    test: function() {
      return result;
    }
  });

  let badPanel = Panel({
    contentURL: "data:text/html;charset=utf-8,",
    contentScriptWhen: "end",
    contentScript: "self.port.emit('window-has-extras', unsafeWindow.extras === undefined)"
  });

  badPanel.port.once("window-has-extras", (data) => {
    assert.equal(data, true, "unsafeWindow.extras is undefined for a data uri")
    loader.unload();
    done();
  });
}

exports["test addon extras are not added to non-addon data: uris in page-workers"] = function(assert, done) {
  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });

  const { Page } = loader.require('sdk/page-worker');
  const extras = loader.require("sdk/addon/extras");

  var result = 1;
  extras.set({
    test: function() {
      return result;
    }
  });

  let badPage = Page({
    contentURL: "data:text/html;charset=utf-8,",
    contentScriptWhen: "end",
    contentScript: "self.port.emit('window-has-extras', unsafeWindow.extras === undefined)"
  });

  badPage.port.once("window-has-extras", (data) => {
    assert.equal(data, true, "unsafeWindow.extras is undefined for a data uri");
    loader.unload();
    done();
  });
}

exports["test addon extras are not added to non-addon about: uris in page-workers"] = function(assert, done) {
  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });

  const { Page } = loader.require('sdk/page-worker');
  const extras = loader.require("sdk/addon/extras");

  var result = 1;
  extras.set({
    test: function() {
      return result;
    }
  });

  let badPage = Page({
    contentURL: "about:mozilla",
    contentScriptWhen: "end",
    contentScript: "self.port.emit('window-has-extras', unsafeWindow.extras === undefined)"
  });

  badPage.port.once("window-has-extras", (data) => {
    assert.equal(data, true, "unsafeWindow.extras is undefined for a data uri");
    loader.unload();
    done();
  });
}

exports["test unsafeWindow.extras is undefined for addon uris in panels with content scripts"] = function*(assert) {
  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });
  assert.pass("created a loader");

  const { Panel } = loader.require('sdk/panel');
  const extras = loader.require("sdk/addon/extras");

  var result = 1;
  extras.set({
    test: function() {
      return result;
    }
  });
  assert.pass("set extras");

  let goodPanel = Panel({
    contentURL: "./test-addon-extras.html",
    contentScriptWhen: "end",
    contentScript: "self.port.on('get-result', _ => self.port.emit('result', typeof unsafeWindow.extras == 'undefined'))"
  });
  assert.pass("created the panel");

  yield new Promise(resolve => {
    goodPanel.port.once("result", (data) => {
      assert.equal(data, true, "unsafeWindow.extras is undefined");
      resolve();
    });
    assert.pass("add listener to panel");

    goodPanel.port.emit("get-result");
  });

  loader.unload();
}

exports["test window.extras is undefined for addon uris in panels with content scripts"] = function(assert, done) {
  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });

  const { Panel } = loader.require('sdk/panel');
  const extras = loader.require("sdk/addon/extras");

  var result = 1;
  extras.set({
    test: function() {
      return result;
    }
  });

  let goodPanel = Panel({
    contentURL: "./test-addon-extras.html",
    contentScriptWhen: "end",
    contentScript: "self.port.on('get-result', _ => {\n" +
      "window.addEventListener('message', ({ data }) => data.name == 'extras' && self.port.emit('result', data.result));\n" +
      "window.postMessage({ name: 'start'}, '*');\n" +
    "});"
  });

  goodPanel.port.once("result", (data) => {
    assert.equal(data, true, "window.extras is undefined");
    loader.unload();
    done();
  });

  goodPanel.port.emit("get-result");
}

exports["test addon extras are added to addon uris in panels"] = function(assert, done) {
  assert.pass("START");

  let loader = Loader(module, null, null, {
    modules: {
      "sdk/self": merge({}, self, {
        data: merge({}, self.data, {url: fixtures.url})
      })
    }
  });
  assert.pass("created the loader");

  const { Panel } = loader.require('sdk/panel');
  assert.pass("require panel");

  const extras = loader.require("sdk/addon/extras");
  assert.pass("require extras");

  var result = 1;
  extras.set({
    test: function() {
      return result;
    }
  });
  assert.pass("set extras");

  let goodPanel = Panel({
    contentURL: "./test-addon-extras.html"
  });

  goodPanel.port.once("result1", (data) => {
    assert.equal(data, 1, "window.extras.test() returned 1");
    loader.unload();
    done();
  });

  goodPanel.port.emit("get-result");
}

before(exports, (name, assert) => {
  // test the default addon.extras value is {}
  assert.strictEqual(extras.get(), undefined, "no extras @ start");
});

after(exports, (name, assert) => {
  // reset extras
  extras.set(undefined);
  assert.strictEqual(extras.get(), undefined, "no extras @ end");
});

require("sdk/test").run(exports);
