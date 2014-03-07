/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "prototype"
};

const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { Disposable } = require("sdk/core/disposable");

const { emit, off, setListeners } = require("sdk/event/core");

const { uri: addonURI } = require("sdk/self");

const { DevtoolAddonTargetFront } = require("./rdp-actor-prototypes/remote-target");

const privateNS = require("sdk/core/namespace").ns();

const InspectTarget = Class({
  implements: [EventTarget, Disposable],
  initialize: function(target) {
    console.log("NEW INSPECT TARGET", target.client, target.form);

    privateNS(this).target = target;
    privateNS(this).client = DevtoolAddonTargetFront(target.client, target.form);

    privateNS(this).client.on("target-tab-attached", (msg) => {
      emit(this, "target-tab-attached", msg);
    })
    privateNS(this).client.on("content-script-message", (msg) => {
      emit(this, "content-script-message", msg);
    })
  },
  destroy: function() {
    privateNS(this).client.off("target-tab-attached");
    privateNS(this).client.off("content-script-message");
  },
  get id() {
    return privateNS(this).target._form.outerWindowID;
  },
  get isApp() {
    return privateNS(this).target.isApp === true;
  },
  get isLocal() {
    return privateNS(this).target.isLocalTab === true;
  },
  postMessage: function (data, origin) {
    var client = privateNS(this).client;
    return client.postMessage.apply(client, arguments);
  },
  postMessageToContentScript: function(data, origin) {
    var client = privateNS(this).client;
    return client.postMessageToContentScript.apply(client, arguments);
  },
  setupInstrumentation: function(opts) {
    var injectJavascriptCode,
        injectJavascriptURL,
        contentScriptCode;
    if (opts.injectJavascriptFile) {
      injectJavascriptCode = self.data.load(opts.injectJavascriptFile);
      injectJavascriptURL = self.data.url(opts.injectJavascriptFile);
    } else {
      injectJavascriptCode = opts.injectJavascriptCode;
      injectJavascriptURL = addonURI;
    }

    if (opts.contentScriptFile) {
      contentScriptCode = self.data.load(opts.contentScriptFile);
    } else {
      contentScriptCode = opts.contentScriptCode;
    }

    return privateNS(this).client.setupInstrumentation(
      contentScriptCode,
      injectJavascriptCode,
      injectJavascriptURL,
      opts.reload
    );
  }
});

module.exports = InspectTarget;
