/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { tabs } = require("api-utils/windows/tabs-fennec");

// Workaround for bug 674195. Freezing objects from other compartments fail,
// so we use `Object.freeze` from the same component as objects
// `hasOwnProperty`. Since `hasOwnProperty` here will be from other component
// we override it to support our workaround.
module.exports = Object.create(tabs, {
  isPrototypeOf: { value: Object.prototype.isPrototypeOf }
});
