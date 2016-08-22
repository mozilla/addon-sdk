/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'experimental'
};

const models = WeakMap();

function get(instance) {
  return models.get(instance);
}
exports.get = get;

function set(instance, model) {
  return models.set(instance, model);
}
exports.set = set;

function remove(instance) {
  models.delete(instance);
}
exports.delete = remove;
