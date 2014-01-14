/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Cu } = require("chrome");
const { Class } = require("../core/heritage");
const { contract } = require("../util/contract");
const { merge } = require("../util/object");

const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
const Telemetry = Services.telemetry;

const model = WeakMap();

const TYPES = {
  "linear": Telemetry.HISTOGRAM_LINEAR,
  "exponential": Telemetry.HISTOGRAM_EXPONENTIAL,
}

exports.Measurement = Class({
  initialize: function(options) {
    options = merge({
      id: undefined,
      name: undefined,
      min: 0,
      max: undefined,
      count: 5,
      type: "linear"
    }, options);
    model.set(this, options);
    register(options);
  },
  add: function add(value) {
    let options = model.get(this);
    if (!options || !options.name)
        throw Error("options are invalid");

    if (options.id) {
      register(options);
      let h = Telemetry.getAddonHistogram(options.id, options.name);
      h.add(value);
    }
    else {
      Telemetry.getHistogramById(options.name).add(value);
    }
    return undefined;
  },
  clear: function clear() {
    let hist;
    let { id, name } = model.get(this);
    try {
      Telemetry.getAddonHistogram(id, name).clear();
    } catch(e) {}
  }
});

function register(options) {
  // if no id is provided then assume the histogram is a global
  // declared in http://mxr.mozilla.org/mozilla-central/source/toolkit/components/telemetry/Histograms.json
  if (options.id) {
    try {
      Telemetry.registerAddonHistogram(options.id,
                                       options.name,
                                       options.min,
                                       options.max,
                                       options.count,
                                       TYPES[options.type]);
    } catch(e) {}
  }
}
