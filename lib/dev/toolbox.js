/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cu, Cc, Ci } = require("chrome");
const { Class } = require("../sdk/core/heritage");
const { Disposable } = require("../sdk/core/disposable");
const { id: addonID, data: { url: resolve }} = require("../sdk/self");
const method = require("method/core");
const { contract, validate } = require("../sdk/util/contract");
const { each, pairs, values } = require("../sdk/util/sequence");

const { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});


// This is temporary workaround to allow loading of the developer tools client code
// into a toolbox panel before it lands.
const registerSDKURI = () => {
  const ioService = Cc['@mozilla.org/network/io-service;1']
                      .getService(Ci.nsIIOService);
  const resourceHandler = ioService.getProtocolHandler("resource")
                                   .QueryInterface(Ci.nsIResProtocolHandler);

  const uri = module.uri.replace("dev/toolbox.js", "");
  resourceHandler.setSubstitution("sdk", ioService.newURI(uri, null, null));
};

registerSDKURI();


const makeID = name =>
  ("pane-" + addonID + "-" + name).
    split("/").join("-").
    split(".").join("-").
    replace(/[^A-Za-z0-9_\-]/g, "");

const build = method("tool/build");
exports.build = build;

const panelID = new WeakMap();
const Tool = Class({
  extends: Disposable,
  setup: function(params={}) {
    const { name, panels } = validate(this, params);

    this.name = name;
    this.panels = panels;

    each(([key, Panel]) => {
      const id = makeID(name + "-" + key);
      const { url, label, tooltip, icon } = validate(Panel.prototype);
      panelID.set(Panel, id);

      gDevTools.registerTool({
        id: id,
        url: "about:blank",
        label: label,
        tooltip: tooltip,
        icon: icon,
        isTargetSupported: target => target.isLocalTab,
        build: (window, toolbox) => build(Panel.prototype,
                                          window,
                                          toolbox,
                                          url)
      });
    }, pairs(panels));
  },
  dispose: function() {
    each(Panel => gDevTools.unregisterTool(panelID.get(Panel)),
         values(this.panels));
  }
});

validate.define(Tool, contract({
  name: {
    is: ["string"],
    ok: x => /^[a-z][a-z0-9-_]+$/i.test(x),
    msg: "The `option.name` must be a valid alphanumeric string (hyphens and " +
         "underscores are allowed) starting with letter."
  },
  panels: {
    is: ["object", "undefined"]
  }
}));

exports.Tool = Tool;
