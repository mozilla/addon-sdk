/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'experimental'
};

const method = require('method/core');
const { uuid } = require('../util/uuid');

const identified = new WeakMap();

let identify = method('identify');
identify.define(function(thing) {
  if (!thing) {
    return uuid();
  }

  if (!identified.has(thing)) {
    identified.set(thing, uuid());
  }

  return identified.get(thing);
});
exports.identify = identify;
