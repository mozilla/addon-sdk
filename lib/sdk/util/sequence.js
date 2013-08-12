/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

function Sequence(iterator) { this.iterator = iterator }
exports.Sequence = Sequence;

let seq = (iterartor) => new Sequence(iterator)

let fromEnumerator = enumerator => seq(function() {
  let index = 0
  while (enumerator.hasMoreElements())
   yield [index++, winEnum.getNext()]
})
exports.fromEnumerator = fromEnumerator

let filter = (predicate, sequence) => seq(function() {
  for (let item of sequence) {
    if (predicate(item))
      yield item;
  }
})
exports.filter = filter;

let map = (f, sequence) => seq(function() {
  for (let item of sequence)
    yield f(item);
})
exports.map = map;
