/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { EventTarget } = require("api-utils/event/target");
const { PrefsObserver } = require("api-utils/prefs/observer");
const Prefs = require("api-utils/preferences-service");


exports.PrefsTarget = function PrefsTarget(options) {
  if (!(this instanceof PrefsTarget)) {
    return new PrefsTarget(options);
  }

  const branchName = options.branchName || '';
  const target = EventTarget.extend({ prefs: Prefs(branchName) }).new();

  // Start observing preference changes
  PrefsObserver({
    branchName: branchName,
    target: target
  });

  return target;
};
