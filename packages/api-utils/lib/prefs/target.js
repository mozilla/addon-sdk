/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci } = require('chrome');
const { Class } = require('api-utils/heritage');
const { EventTarget } = require('api-utils/event/target');
const { Branch } = require('api-utils/preferences-service');
const { emit, off } = require('api-utils/event/core');
const { when: unload } = require('api-utils/unload');

const prefTargetNS = require('namespace').ns();

const PrefsTarget = Class({
  extends: EventTarget,
  initialize: function(options) {
    options = options || {};
    EventTarget.prototype.initialize.call(this, options);

    let branchName = options.branchName || '';
    let branch = Cc["@mozilla.org/preferences-service;1"].
        getService(Ci.nsIPrefService).
        getBranch(branchName).
        QueryInterface(Ci.nsIPrefBranch2);
    prefTargetNS(this).branch = branch;

    // provides easy access to preference values
    this.prefs = Branch(branchName);

    // start listening to preference changes
    let observer = prefTargetNS(this).observer = onChange.bind(this);
    branch.addObserver('', observer, false);

    // Make sure to destroy this on unload
    unload(destroy.bind(this));
  }
});
exports.PrefsTarget = PrefsTarget;

/* HELPERS */

function onChange(subject, topic, name) {
  if (topic === 'nsPref:changed')
    emit(this, name, name);
}

function destroy() {
  off(this);

  // stop listening to preference changes
  let branch = prefTargetNS(this).branch;
  branch.removeObserver('', prefTargetNS(this).observer, false);
  prefTargetNS(this).observer = null;
}
