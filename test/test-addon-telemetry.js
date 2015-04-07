/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cu } = require("chrome");
const { id } = require("sdk/self");
const { Measurement, unregister } = require('sdk/addon/telemetry');

const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});
const Telemetry = Services.telemetry;

exports.testAddClearUnregister = function(assert) {
  let options = {
    id: id,
    name: "testing-histogram1",
    min: 1,
    max: 5,
    count: 6
  };
  let m = Measurement(options);

  assert.equal(options.id, id, 'options.id did not change');
  assert.equal(options.name, "testing-histogram1", 'options.name did not change');
  assert.throws(function() {
    Telemetry.registerAddonHistogram(id, options.name, 1, 3, 5, 1);
  }, /nsITelemetry.registerAddonHistogram/, 'registered telemetry measurement properly');
  assert.throws(function() {
    let h1 = Telemetry.getAddonHistogram(id + "X", options.name);
  }, /nsITelemetry.getAddonHistogram/, 'fake id fails');
  let hist = Telemetry.getAddonHistogram(id, options.name);
  assert.equal(hist.snapshot().counts[0], 0, 'data does not exist');
  m.add(0);
  assert.equal(hist.snapshot().counts[0], 1, 'data was added');
  m.clear();
  assert.equal(hist.snapshot().counts[0], 0, 'data was added');
  hist = Telemetry.getAddonHistogram(id, options.name);
  unregister();
  assert.throws(function() {
    hist = Telemetry.getAddonHistogram(id, options.name);
  }, /nsITelemetry.getAddonHistogram/, 'clear worked');

  // try re-add afterwards
  m.add(0);
  hist = Telemetry.getAddonHistogram(id, options.name);
  assert.equal(hist.snapshot().counts[0], 1, 'data was added');
  m.clear();
  assert.equal(hist.snapshot().counts[0], 0, 'data was added');
  hist = Telemetry.getAddonHistogram(id, options.name);
  unregister();
  assert.throws(function() {
    hist = Telemetry.getAddonHistogram(id, options.name);
  }, /nsITelemetry.getAddonHistogram/, 'unregister worked');

}

require('sdk/test').run(exports);
