/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci } = require("chrome");
const { Class } = require('api-utils/heritage');
const { EventTarget } = require('api-utils/event/target');
const { Branch } = require("api-utils/preferences-service");
const { emit, off } = require("api-utils/event/core");
const { when: unload } = require("api-utils/unload");

const PrefsTarget = Class({
  extends: EventTarget,
  initialize: function(options) {
    EventTarget.prototype.initialize.call(this, options);

    let branchName = options.branchName || '';
    let branch = Cc["@mozilla.org/preferences-service;1"].
        getService(Ci.nsIPrefService).
        getBranch(branchName).
        QueryInterface(Ci.nsIPrefBranch2);
    this.prefs = Branch(branchName);

    let preferenceChange = onChange.bind(this);
    branch.addObserver('', preferenceChange, false);

    // Make sure we cleanup listeners on unload.
    unload(onUnload.bind(this, branch, preferenceChange));
  }
});

function onChange(subject, topic, name) {
  if (topic === 'nsPref:changed') {
    emit(this, name, name);
  }
}

function onUnload(branch, observer) {
  off(this);
  branch.removeObserver('', observer, false);
}

exports.PrefsTarget = PrefsTarget;
