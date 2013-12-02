/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { WindowEventPort } = require("./window-event");
const { getTabs, isPinned } = require("../tabs/utils");
const { set } = require("./collection");
const { lazy } = require("../util/iteration");

const opened = lazy(() => getTabs());
const pinned = lazy(() => getTabs().filter(isPinned));

// This is temporary shim until Bug 843901 is fixed.
const LastOpened = new WindowEventPort({type: "TabOpen"});
exports.LastOpened = LastOpened;

const LastClosed = new WindowEventPort({type: "TabClose"});
exports.LastClosed = LastClosed;

const Opened = set(LastOpened, LastClosed, opened);
exports.Opened = Opened;

const LastSelected = new WindowEventPort({type: "TabSelect"});
exports.LastSelected = LastSelected;

const LastMoved = new WindowEventPort({type: "TabMove"});
exports.LastMoved = LastMoved;

const LastPinned = new WindowEventPort({type: "TabPinned"});
exports.LastPinned = LastPinned;

const LastUnpinned = new WindowEventPort({type: "TabUnpinned"});
exports.LastUnpinned = LastUnpinned;

const Pinned = set(LastPinned, LastUnpinned, pinned);
exports.Pinned = Pinned;
