/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Measurement: CoreMeasurement } = require("../telemetry/measurement");
const { Class } = require("../core/heritage");

const Measurement = Class({
  extends: CoreMeasurement,
  initialize: function(options) {
    CoreMeasurement.prototype.initialize.call(this, {
      name: options.name
    });
  }
});

exports.add = function add(options) {
  try {
    Measurement({ name: options.name }).add(options.value);
  }
  catch(e) {
    throw Error("options are invalid");
  }
}
