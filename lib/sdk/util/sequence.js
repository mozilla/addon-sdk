/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

let { complement } = require("../lang/functional");
let { iteratorSymbol } = require("../util/iteration");
let { isArray, isArguments, isMap, isSet, isString } = require("../lang/type");

function Sequence(iterator) { this[iteratorSymbol] = iterator }
exports.Sequence = Sequence;

let seq = iterator => new Sequence(iterator);
exports.seq = seq;

let fromEnumerator = getEnumerator => seq(function* () {
  let enumerator = getEnumerator();
  while (enumerator.hasMoreElements())
   yield enumerator.getNext();
});
exports.fromEnumerator = fromEnumerator;

// Returns a lazy sequence of `x`, `f(x)`, `f(f(x))` etc.
// `f` must be free of side-effects. Note that returned
// sequence is infinite so it must be consumed partially.
//
// Implements clojure iterate:
// http://clojuredocs.org/clojure_core/clojure.core/iterate
let iterate = (f, x) => seq(function* () {
  let state = x;
  while (true) {
    yield state;
    state = f(state);
  }
});
exports.iterate = iterate;

// Returns a lazy sequence of the items in sequence for which `p(item)`
// returns `true`. `p` must be free of side-effects.
//
// Implements clojure filter:
// http://clojuredocs.org/clojure_core/clojure.core/filter
let filter = (p, sequence) => seq(function* () {
  if (sequence !== null && sequence !== void(0)) {
    for (let item of sequence) {
      if (p(item))
        yield item;
    }
  }
});
exports.filter = filter;

// Returns a lazy sequence consisting of the result of applying `f` to the
// set of first items of each sequence, followed by applying f to the set
// of second items in each sequence, until any one of the sequences is
// exhausted. Any remaining items in other sequences are ignored. Function
// `f` should accept number-of-sequences arguments.
//
// Implements clojure map:
// http://clojuredocs.org/clojure_core/clojure.core/map
let map = (f, ...sequences) => seq(function* () {
  let count = sequences.length;
  // Optimize a single sequence case
  if (count === 1) {
    let [sequence] = sequences;
    if (sequence !== null && sequence !== void(0)) {
      for (let item of sequence)
        yield f(item);
    }
  }
  else {
    // define args array that will be recycled on each
    // step to aggregate arguments to be passed to `f`.
    let args = [];
    // define inputs to contain started generators.
    let inputs = [];

    let index = 0;
    while (index < count) {
      inputs[index] = sequences[index][iteratorSymbol]();
      index = index + 1;
    }

    // Run loop yielding of applying `f` to the set of
    // items at each step until one of the `inputs` is
    // exhausted.
    let done = false;
    while (!done) {
      let index = 0;
      let value = void(0);
      while (index < count && !done) {
        ({ done, value }) = inputs[index].next();

        // If input is not exhausted yet store value in args.
        if (!done) {
          args[index] = value;
          index = index + 1;
        }
      }

      // If none of the inputs is exhasted yet, `args` contain items
      // from each input so we yield application of `f` over them.
      if (!done)
        yield f(...args);
    }
  }
});
exports.map = map;

// Returns a lazy sequence of the intermediate values of the reduction (as
// per reduce) of sequence by `f`, starting with `initial` value if provided.
//
// Implements clojure reductions:
// http://clojuredocs.org/clojure_core/clojure.core/reductions
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

  return seq(function* () {
    let started = hasInitial;
    let result = void(0);

    // If initial is present yield it.
    if (hasInitial)
      yield result = initial;

    // For each item of the sequence accumulate new result.
    for (let item of sequence) {
      // If nothing has being yield yet set result to first
      // item and yield it.
      if (!started) {
        started = true;
        yield result = item;
      }
      // Otherwise accumulate new result and yield it.
      else {
        yield result = f(result, item);
      }
    }

    // If nothing has being yield yet it's empty sequence and no
    // `initial` was provided in which case we need to yield `f()`.
    if (!started)
      yield f();
  });
};
exports.reductions = reductions;

// `f` should be a function of 2 arguments. If `initial` is not supplied,
// returns the result of applying `f` to the first 2 items in sequence, then
// applying `f` to that result and the 3rd item, etc. If sequence contains no
// items, `f` must accept no arguments as well, and reduce returns the
// result of calling f with no arguments. If sequence has only 1 item, it
// is returned and `f` is not called. If `initial` is supplied, returns the
// result of applying `f` to `initial` and the first item in  sequence, then
// applying `f` to that result and the 2nd item, etc. If sequence contains no
// items, returns `initial` and `f` is not called.
//
// Implements clojure reduce:
// http://clojuredocs.org/clojure_core/clojure.core/reduce
let reduce = (...args) => {
  let xs = reductions(...args);
  let x;
  for (x of xs) void(0);
  return x;
};
exports.reduce = reduce;

let inc = x => x + 1
// Returns the number of items in the sequence. `count(null)` && `count()`
// returns `0`. Also works on strings, arrays, Maps & Sets.

// Implements clojure count:
// http://clojuredocs.org/clojure_core/clojure.core/count
let count = sequence =>
  // Optimize type specific use cases
  isArray(sequence) ? sequence.length :
  isString(sequence) ? sequence.length :
  isArguments(sequence) ? sequence.length :
  isMap(sequence) ? sequence.size :
  isSet(sequence) ? sequence.size :
  null === sequence ? 0 :
  void(0) === sequence ? 0 :
  // And fallback to actual counting.
  reduce(inc, 0, sequence)
exports.count = count;

// Returns `true` if sequence has no items.

// Implements clojure empty?:
// http://clojuredocs.org/clojure_core/clojure.core/empty_q
let isEmpty = sequence => {
  // Treat `null` and `undefined` as empty sequences.
  if (sequence === null || sequence === void(0))
    return true;

  // If contains any item non empty so return `false`.
  for (let _ of sequence)
    return false;

  // If has not returned yet, there was nothing to iterate
  // so it's empty.
  return true;
}
exports.isEmpty = isEmpty;

let and = (a, b) => a && b

// Returns true if `p(x)` is logical `true` for every `x` in sequence, else
// `false`.
//
// Implements clojure every?:
// http://clojuredocs.org/clojure_core/clojure.core/every_q
let isEvery = (p, sequence) => {
  if (sequence !== null && sequence !== void(0)) {
    for (let item of sequence) {
      if (!p(item))
        return false;
    }
  }
  return true;
};
exports.isEvery = isEvery;

// Returns the first logical true value of (p x) for any x in sequence,
// else `null`.
//
// Implements clojure some:
// http://clojuredocs.org/clojure_core/clojure.core/some
let some = (p, sequence) => {
  if (sequence !== null && sequence !== void(0)) {
    for (let item of sequence) {
      if (p(item))
        return true;
    }
  }
  return null;
};
exports.some = some;

// Returns a lazy sequence of the first `n` items in sequence, or all items if
// there are fewer than `n`.
//
// Implementns clojure take:
// http://clojuredocs.org/clojure_core/clojure.core/take
let take = (n, sequence) => seq(function* () {
  let count = n;
  for (let item of sequence) {
    if (count <= 0)
      break;

    yield item;
    count = count - 1;
  }
});
exports.take = take;

// Returns a lazy sequence of successive items from sequence while
// `p(item)` returns `true`. `p` must be free of side-effects.
//
// Implementns clojure take-while:
// http://clojuredocs.org/clojure_core/clojure.core/take-while
let takeWhile = (p, sequence) => seq(function* () {
  for (let item of sequence) {
    if (!p(item))
      break;

    yield item;
  }
});
exports.takeWhile = takeWhile;

let drop = (n, sequence) => seq(function* () {
  if (sequence !== null && sequence !== void(0)) {
    let count = n;
    for (let item of sequence) {
      if (count > 0)
        count = count - 1;
      else
        yield item;
    }
  }
});
exports.drop = drop;

let dropWhile = (p, sequence) => seq(function* () {
  let keep = false
  for (let item of sequence) {
    keep = keep || !p(item);
    if (keep) yield item;
  }
});
exports.dropWhile = dropWhile;

let concat = (...sequences) => seq(function* () {
  for (let sequence of sequences)
    for (let item of sequence)
      yield item;
});
exports.concat = concat;

let first = sequence => {
  if (sequence !== null && sequence !== void(0)) {
    for (let item of sequence)
      return item;
  }
  return null;
}
exports.first = first;

let rest = sequence => drop(1, sequence);
exports.rest = rest;

// Returns the value at the index. Returns `notFound` or `undefined`
// if index is out of bounds.
let nth = (xs, n, notFound) => {
  if (n >= 0) {
    if (isArray(xs) || isArguments(xs) || isString(xs)) {
      return n < xs.length ? xs[n] : notFound;
    }
    else if (xs !== null && xs !== void(0)) {
      let count = n;
      for (let x of xs) {
        if (count <= 0)
          return x;

        count = count - 1;
      }
    }
  }
  return notFound;
}
exports.nth = nth;

// Return the last item in sequence, in linear time.
// If `sequence` is an array or string or arguments
// returns in constant time.
// Implements clojure last:
// http://clojuredocs.org/clojure_core/clojure.core/last
let last = xs =>
  isArray(xs) ? xs[xs.length - 1] :
  isString(xs) ? xs[xs.length - 1] :
  isArguments(xs) ? xs[xs.length - 1] :
  xs === null ? null :
  xs === void(0) ? null :
  reduce((_, x) => x, xs)
exports.last = last;

let butlast = sequence => seq(function* () {
  let head = first(sequence);
  let rest = tail(sequence);

  for (let item of tail) {
    yield head;
    head = item;
  }
});
exports.butlast = butlast;

let distinct = sequence => seq(function* () {
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

let mapcat = (f, sequence) => seq(function* () {
  let sequences = map(f, sequence)
  for (let sequence of sequences)
    for (let item of sequence)
      yield item;
});
exports.mapcat = mapcat;
