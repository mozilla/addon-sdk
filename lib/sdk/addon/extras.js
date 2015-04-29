/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
 "use strict";

module.metadata = {
  "stability": "experimental"
};

// NOTE: This is very experimental!
// This will only add extra values
// to a worker in the same process
// that this module is loaded in.

var extraAddonData = {};

function set(data) {
  return extraAddonData = data;
}
exports.set = set;


function get() {
  return extraAddonData;
}
exports.get = get;
