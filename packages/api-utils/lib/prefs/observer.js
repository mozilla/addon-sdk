/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { emit, off } = require("api-utils/event/core");
const { when: unload } = require("api-utils/unload");

exports.PrefsObserver = function PrefsObserver(options) {
  if (!(this instanceof PrefsObserver)) {
    return new PrefsObserver(options);
  }
  // if no target is defined, then there is nothing to do.
  else if (!options.target) {
    return;
  }

  const branchName = options.branchName || '';
  const target = options.target;

  const branch = Cc["@mozilla.org/preferences-service;1"].
               getService(Ci.nsIPrefService).
               getBranch(branchName).
               QueryInterface(Ci.nsIPrefBranch2);

  // Listen to changes in the preferences
  function preferenceChange(subject, topic, name) {
   if (topic === 'nsPref:changed')
     emit(target, name, name);
  }
  branch.addObserver('', preferenceChange, false);


  // Make sure we cleanup listeners on unload.
  unload(function() {
    branch.removeObserver('', preferenceChange, false);
  });
  
  return this;
};
