/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Cu } = require("chrome");
const { Measurement: CoreMeasurement } = require("../telemetry/measurement");
const { Class } = require("../core/heritage");
const { id } = require("../self");
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

exports.Measurement = Class({
  extends: CoreMeasurement,
  initialize: function(options) {
    options.id = id;
    CoreMeasurement.prototype.initialize.call(this, options);
  }
});

function unregister() {
  Services.telemetry.unregisterAddonHistograms(id);
}
exports.unregister = unregister;
