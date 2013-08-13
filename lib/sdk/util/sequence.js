/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

let { complement } = require("../lang/functional");

function Sequence(iterator) { this.iterator = iterator }
exports.Sequence = Sequence;

let seq = iterator => new Sequence(iterator);
exports.seq = seq;

let fromEnumerator = getEnumerator => seq(function() {
  let enumerator = getEnumerator();
  while (enumerator.hasMoreElements())
   yield enumerator.getNext();
});
exports.fromEnumerator = fromEnumerator;

let filter = (p, sequence) => seq(function() {
  for (let item of sequence) {
    if (p(item))
      yield item;
  }
});
exports.filter = filter;

let map = (f, sequence) => seq(function() {
  for (let item of sequence)
    yield f(item);
});
exports.map = map;

let reductions = (...params) => {
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
    if (hasInitial)
      yield result = initial;
    for (let item of sequence) {
      if (!started) {
        started = true;
        yield result = item;
      }
      else {
        yield result = f(result, item);
      }
    }
  });
};
exports.reductions = reductions;


let reduce = (f, ...rest) => {
  let accumulate = (accumulated, value) => result = f(accumulated, value);
  rest.unshift(f);
  let sequence = reductions.apply(null, rest);
  let result;
  for (let item of sequence) result = item;
  return result;
};
exports.reduce = reduce;


let inc = x => x + 1
let count = sequence => reduce(inc, 0, sequence)
exports.count = count;

let isEmpty = sequence => count(sequence) === 0
exports.isEmpty = isEmpty;

let and = (a, b) => a && b
let every = (p, sequence) => seq(function() {
  for (let item of sequence)
    if (!p(item)) return false;

  return true;
});
exports.every = every;

let some = (p, sequence) => seq(function() {
  for (let item of sequence)
    if (p(item))
      return true;

  return false;
});
exports.some = some;

let take = (n, sequence) => seq(function() {
  let count = n;
  for (let item of sequence) {
    if (count <= 0)
      throw StopIteration;

    yield item;
    count = count - 1;
  }
});
exports.take = take;

let takeWhile = (p, sequence) => seq(function() {
  for (let item of sequence) {
    if (!p(item))
      throw StopIteration;

    yield item;
  }
});
exports.takeWhile = takeWhile;

let drop = (n, sequence) => seq(function() {
  let count = n;
  for (let item of sequence) {
    if (count > 0)
      count = count - 1;
    else
      yield item;
  }
});
exports.drop = drop;

let dropWhile = (p, sequence) => seq(function() {
  let keep = false
  for (let item of sequence) {
    keep = keep || !p(item);
    if (keep) yield item;
  }
});
exports.dropWhile = dropWhile;

let concat = (...sequences) => seq(function() {
  for (let sequence of sequences)
    for (let item of sequence)
      yield item;
});
exports.concat = concat;

let first = sequence => {
  for (let item of sequence)
    return item;
}
exports.first = first;

let rest = sequence => drop(1, sequence);
exports.rest = rest;

let nth = (sequence, n) => first(drop(n - 1, sequence));
exports.nth = nth;

let last = sequence => reduce((_, item) => item, sequence)
exports.last = last;

let butlast = sequence => seq(function() {
  let head = first(sequence);
  let rest = tail(sequence);

  for (let item of tail) {
    yield head;
    head = item;
  }
});
exports.butlast = butlast;

let distinct = sequence => seq(function() {
  let items = new Set();
  for (let item of sequence) {
    if (!items.has(item)) {
      items.add(item);
      yield item;
    }
  }
});
exports.distinct = distinct;

let remove = (p, sequence) => filter(complement(p), sequence);
exports.remove = remove;

let mapcat = (f, sequence) => seq(function() {
  let sequences = map(f, sequence)
  for (let sequence of sequences)
    for (let item of sequence)
      yield item;
});
exports.mapcat = mapcat;
