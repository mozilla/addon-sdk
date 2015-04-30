/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Ci, Cu, Cc, components } = require('chrome');
const extras = require("sdk/addon/extras");
const self = require("sdk/self");
const { before, after } = require('sdk/test/utils');
const fixtures = require("./fixtures");
const { Loader } = require('sdk/test/loader');
const { merge } = require("sdk/util/object");

const EXPECTED = JSON.stringify({});

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


function toArray(args) {
   return Array.prototype.slice.call(args).map((arg) => {
     return JSON.stringify({ name: arg.name, value: arg.value })
   });
}

exports["test window result from addon extras in panel"] = function(assert, done) {
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

  let page = Page({
    contentURL: "./test.html"
  });
  let pageFrame = getActiveView(page);
  let pageWindow = pageFrame.contentWindow;
  console.log(toArray(pageFrame.attributes));

  extras.set({
    test: function(window) {
      return pageWindow.wrappedJSObject;
    }
  });

  let panel = Panel({
    contentURL: "./test-addon-extras-window.html"
  });
  let panelFrame = getActiveView(panel).firstChild;
  console.log(toArray(panelFrame.attributes));

  panel.port.once("result1", (result) => {
    assert.equal(result, fixtures.url("./test.html"), "result is a window");
    loader.unload();
    done()
  });

  panel.port.emit("get-result");
}

before(exports, (name, assert) => {
  // test the default addon.extras value is {}
  assert.equal(JSON.stringify(extras.get()), EXPECTED, "no extras");
});
after(exports, (name, assert) => {
  // reset extras
  extras.set({});
  assert.equal(JSON.stringify(extras.get()), EXPECTED, "no extras");
});

require("sdk/test").run(exports);
