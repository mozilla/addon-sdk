/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

let assetsURI = require("../self").data.url();
let isArray = Array.isArray;

function isAddonContent({ contentURL }) {
  return typeof(contentURL) === "string" && contentURL.indexOf(assetsURI) === 0;
}
exports.isAddonContent = isAddonContent;

function hasContentScript({ contentScript, contentScriptFile }) {
  return (isArray(contentScript) ? contentScript.length > 0 :
         !!contentScript) ||
         (isArray(contentScriptFile) ? contentScriptFile.length > 0 :
         !!contentScriptFile);
}
exports.hasContentScript = hasContentScript;

function requiresAddonGlobal(model) {
  return isAddonContent(model) && !hasContentScript(model);
}
exports.requiresAddonGlobal = requiresAddonGlobal;

function getAttachEventType(model) {
  let when = model.contentScriptWhen;
  return requiresAddonGlobal(model) ? "sdk-panel-content-changed" :
         when === "start" ? "sdk-panel-content-changed" :
         when === "end" ? "sdk-panel-document-loaded" :
         when === "ready" ? "sdk-panel-content-loaded" :
         null;
}
exports.getAttachEventType = getAttachEventType;

