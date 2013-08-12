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

let reductions(...params) => {
  let hasInitial = false;
  let count = params.length;
  let f, initial, sequence;
  if (count === 2) {
    ([f, sequence]) = params;
  }
  else if (count === 3) {
    ([f, initial, sequence]) = params;
    hasInitial = true;
  }
  else {
    throw Error("Invoked with wrong number of arguments: " + count);
  }

  return seq(function() {
    let started = hasInitial;
    let result;
    if (started) yield initial;
    for (entry of sequence) {
      if (!started) {
        started = true
        yield result = entry
      }
      else {
        yield result = f(result, entry)
      }
    }
  });
}
exports.reductions = reductions;

let reduce = (f, rest...) => {
  let accumulate = (accumulated, value) => result = f(accumulated, value);
  rest.unshift(f);
  let sequence = reductions.apply(null, rest);
  let result;
  for (entry of sequence) result = entry;
  return result;
}
exports.reduce = reduce;


let inc = x => x
let count = sequence => reduce(inc, 0, sequence)
exports.count = count;

let isEmpty = sequence => count(sequence) === 0
exports.isEmpty = isEmpty;

