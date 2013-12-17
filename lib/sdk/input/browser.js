/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { keepIf } = require("elmjs/signal");
const { isBrowser, windows, isInteractive,
        isDocumentLoaded } = require("../window/utils");
const { lazy } = require("../util/iteration");
const { set } = require("./collection");
const Window = require("./window");

// Create lazy iterators from the regular arrays, although
// once https://github.com/mozilla/addon-sdk/pull/1314 lands
// `windows` will be transforme to lazy iterators.
// When iterated over belowe sequences items will represent
// state of windows at the time of iteration.
const opened = lazy(() =>
  windows("navigator:browser", {includePrivates: true}));
const interactive = lazy(() =>
  windows("navigator:browser", {includePrivates: true}).filter(isInteractive));
const loaded = lazy(() =>
  windows("navigator:browser", {includePrivates: true}).filter(isDocumentLoaded));


const LastInteractive = keepIf(isBrowser, null, Window.LastInteractive);
const LastLoaded = keepIf(isBrowser, null, Window.LastLoaded);
const LastClosed = keepIf(isBrowser, null, window.LastClosed);

// Signal represents set of top level interactive windows, updated any
// time new window becomes interactive or one get's closed.
const Interactive = set(LastInteractive, LastClosed, interactive);
exports.Interactive = Interactive;

// Signal represents set of top level loaded window, updated any time
// new window becomes interactive or one get's closed.
const Loaded = set(LastLoaded, LastClosed, loaded);
exports.Loaded = Loaded;
