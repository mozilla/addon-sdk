/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { start, stop, receive } = require("elmjs/signal");
const { windows, isInteractive, isDocumentLoaded } = require("../window/utils");
const { InputPort } = require("./system");
const { OutputPort } = require("../output/system");
const { WindowEventPort } = require("./window-event");
const { set } = require("./collection");
const { lazy } = require("../util/iteration");

// Create lazy iterators from the regular arrays, although
// once https://github.com/mozilla/addon-sdk/pull/1314 lands
// `windows` will be transforme to lazy iterators.
// When iterated over belowe sequences items will represent
// state of windows at the time of iteration.
const opened = lazy(() =>
  windows(null, {includePrivates: true}));
const interactive = lazy(() =>
  windows(null, {includePrivates: true}).filter(isInteractive));
const loaded = lazy(() =>
  windows(null, {includePrivates: true}).filter(isDocumentLoaded));

// Signal represents last opened top level window.
const LastOpened = new InputPort({topic: "domwindowopened"});
exports.LastOpened = LastOpened;

// Signal represents last top level window closed.
const LastClosed = new InputPort({topic: "domwindowclosed"});
exports.LastClosed = LastClosed;

// Following two are temporary shims until Bug 843910 is fixed.

const isDocumentCurrentTarget = ({target, currentTarget}) =>
  target === currentTarget.document;

// Signal represents last top level window who's document became interactive.
// Which is updated once `DOMContentLoaded` event dispatched on a top level window.
const LastInteractive = new WindowEventPort({topic: "chrome-document-interactive",
                                             type: "DOMContentLoaded",
                                             keep: isDocumentCurrentTarget});
exports.LastInteractive = LastInteractive;

// Signal represents last top level window that was fully loaded.
// Which is updated once `load` event dispatched on a top level window.
const LastLoaded = new WindowEventPort({topic: "chrome-document-loaded",
                                        type: "load",
                                        keep: e => isDocumentCurrentTarget});
exports.LastLoaded = LastLoaded;


// Signal represents set of currently opened top level windows, updated
// to new set any time window is opened or closed.
const Opened = set(LastOpened, LastClosed, opened);
exports.Opened = Opened;

// Signal represents set of top level interactive windows, updated any
// time new window becomes interactive or one get's closed.
const Interactive = set(LastInteractive, LastClosed, interactive);
exports.Interactive = Interactive;

// Signal represents set of top level loaded window, updated any time
// new window becomes interactive or one get's closed.
const Loaded = set(LastLoaded, LastClosed, loaded);
exports.Loaded = Loaded;
