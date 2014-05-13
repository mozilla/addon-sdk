/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "engines": {
    "Firefox": "*"
  }
};

const { Tool } = require("dev/toolbox");
const { Panel } = require("dev/panel");
const { Class } = require("sdk/core/heritage");
const { openToolbox, closeToolbox, getCurrentPanel } = require("dev/utils");

const makeHTML = fn =>
  "data:text/html;charset=utf-8,<script>(" + fn + ")();</script>";


const test = function(unit) {
  return function*(assert) {
    assert.isRendered = (panel, toolbox) => {
      const doc = toolbox.doc;
      assert.ok(doc.querySelector("[value='" + panel.label + "']"),
                "panel.label is found in the developer toolbox DOM");
      assert.ok(doc.querySelector("[tooltiptext='" + panel.tooltip + "']"),
                "panel.tooltip is found in the developer toolbox DOM");

      assert.ok(doc.querySelector("#toolbox-panel-" + panel.id),
                "toolbar panel with a matching id is present");
    };


    yield* unit(assert);
  };
};
exports["test Panel API"] = test(function*(assert) {
  const MyPanel = Class({
    extends: Panel,
    label: "test panel",
    tooltip: "my test panel",
    url: makeHTML(() => {
      document.documentElement.innerHTML = "hello world";
    }),
    setup: function({debuggee}) {
      this.debuggee = debuggee;
      assert.equal(this.readyState, "uninitialized",
                   "at construction time panel document is not inited");
    },
    dispose: function() {
      delete this.debuggee;
    }
  });
  assert.ok(MyPanel, "panel is defined");


  const myTool = new Tool({
    panels: {
      myPanel: MyPanel
    }
  });
  assert.ok(myTool, "tool is defined");


  var toolbox = yield openToolbox(MyPanel);
  var panel = yield getCurrentPanel(toolbox);
  assert.ok(panel instanceof MyPanel, "is instance of MyPanel");

  assert.isRendered(panel, toolbox);

  if (panel.readyState === "uninitialized") {
    yield panel.ready();
    assert.equal(panel.readyState, "interactive", "panel is ready");
  }

  yield panel.loaded();
  assert.equal(panel.readyState, "complete", "panel is loaded");

  yield closeToolbox();

  assert.equal(panel.readyState, "destroyed", "panel is destroyed");
});

require("test").run(exports);
