/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

function toArray(iterator) {
  let array = [];
  for each (let item in iterator)
    array.push(item);
  return array;
}
exports.toArray = toArray;
