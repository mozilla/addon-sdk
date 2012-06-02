/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cc, Ci } = require("chrome");
const { Class } = require('api-utils/heritage');
const { EventTarget } = require('api-utils/event/target');
const { Branch } = require("api-utils/preferences-service");
const { emit, off } = require("api-utils/event/core");
const { when: unload } = require("api-utils/unload");

const PrefsTarget = Class({
  extends: EventTarget,
  initialize: function(options) {
    EventTarget.prototype.initialize(options);

    let branch;
    let (branchName = options.branchName || '') {
      this.prefs = Branch(branchName);

      branch = Cc["@mozilla.org/preferences-service;1"].
        getService(Ci.nsIPrefService).
        getBranch(branchName).
        QueryInterface(Ci.nsIPrefBranch2);
    }

    let preferenceChange = function(subject, topic, name) {
      if (topic === 'nsPref:changed') {
        emit(this, name, name);
      }
    }.bind(this);
    branch.addObserver('', preferenceChange, false);

    // Make sure we cleanup listeners on unload.
    unload(function() {
      off(this);
      branch.removeObserver('', preferenceChange, false);
    }.bind(this));
  }
});

exports.PrefsTarget = PrefsTarget;
