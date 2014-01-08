/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let { deprecateUsage } = require("../util/deprecate");

deprecateUsage("Module 'sdk/event/target' is deprecated use `require('events').EventEmitter` instead.");

exports.EventTarget = require("../../node/events").EventEmitter;
