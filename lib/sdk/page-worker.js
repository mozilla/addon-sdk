/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "stable"
};

const { Symbiont } = require("./content/symbiont");
const { Class } = require("./core/heritage");

const Page = Class({
  extends: Symbiont,
  setupSymbiont: Symbiont.prototype.setup,
  setup: function setup(options) {
    options = options || {};

    this.contentURL = "contentURL" in options ? options.contentURL
      : "about:blank";
    if ("contentScriptWhen" in options)
      this.contentScriptWhen = options.contentScriptWhen;
    if ("contentScriptFile" in options)
      this.contentScriptFile = options.contentScriptFile;
    if ("contentScriptOptions" in options)
      this.contentScriptOptions = options.contentScriptOptions;
    if ("contentScript" in options)
      this.contentScript = options.contentScript;
    if ("allow" in options)
      this.allow = options.allow;
    if ("onError" in options)
      this.on("error", options.onError);
    if ("onMessage" in options)
      this.on("message", options.onMessage);

    let page = this;
    this.on("propertyChange", function(event) {
      if ("contentURL" in event && page._frame) {
        // Cleanup the worker before injecting the content script in the new
        // document
        page._workerCleanup();
        page._initFrame(page._frame);
      }
    });

    this.setupSymbiont();
  }
});

exports.Page = Page;
