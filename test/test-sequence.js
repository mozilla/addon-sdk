/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { seq, iterate, filter, map, reductions, reduce, count,
      isEmpty, every, isEvery, some, take, takeWhile, drop,
      dropWhile
    } = require("sdk/util/sequence");
let { fromIterator } = require("sdk/util/array");

exports["test seq"] = assert => {
  let xs = seq(function*() {
    yield 1;
    yield 2;
    yield 3;
  });

  assert.deepEqual(fromIterator(xs), [1, 2, 3], "seq of 1 2 3");
};

exports["test filter"] = assert => {
  let isOdd = x => x % 2
  let xs = seq(function*() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
  });
  let ys = filter(isOdd, xs);

  assert.deepEqual(fromIterator(ys), [1, 3], "filtered odds");
};

exports["test filter array"] = assert => {
  let isOdd = x => x % 2
  let xs = filter(isOdd, [1, 2, 3, 4])

  assert.deepEqual(fromIterator(xs), [1, 3], "filteres odds")
  assert.ok(!Array.isArray(xs))
};

exports["test filter lazy"] = assert => {
  let x = 1;
  let y = 2;

  let xy = seq(function*() { yield x; yield y; });
  let isOdd = x => x % 2
  let actual = filter(isOdd, xy);

  assert.deepEqual(fromIterator(actual), [1], "only one odd number");
  y = 3
  assert.deepEqual(fromIterator(actual), [1, 3], "filter is lazy");
};

exports["test map"] = assert => {
  let inc = x => x + 1
  let xs = seq(function*() { yield 1; yield 2; yield 3; });
  let ys = map(inc, xs);

  assert.deepEqual(fromIterator(ys), [2, 3, 4], "incremented each item")
};

exports["test map two inputs"] = assert => {
  let sum = (x, y) => x + y
  let xs = seq(function*() { yield 1; yield 2; yield 3; });
  let ys = seq(function*() { yield 4; yield 5; yield 6; });

  let zs = map(sum, xs, ys);

  assert.deepEqual(fromIterator(zs), [5, 7, 9], "summed numbers")
};

exports["test map diff sized inputs"] = assert => {
  let sum = (x, y) => x + y
  let xs = seq(function*() { yield 1; yield 2; yield 3; });
  let ys = seq(function*() { yield 4; yield 5; yield 6; yield 7; yield 8; });

  let zs = map(sum, xs, ys);

  assert.deepEqual(fromIterator(zs), [5, 7, 9], "summed numbers");
  assert.deepEqual(fromIterator(map(sum, ys, xs)), [5, 7, 9],
                   "index of exhasting input is irrelevant");
};

exports["test map multi"] = assert => {
  let sum = (x, y, z, w) => x + y + z + w
  let xs = seq(function*() { yield 1; yield 2; yield 3; yield 4; });
  let ys = seq(function*() { yield 4; yield 5; yield 6; yield 7; yield 8; });
  let zs = seq(function*() { yield 10; yield 11; yield 12; });
  let ws = seq(function*() { yield 0; yield 20; yield 40; yield 60; });

  let actual = map(sum, xs, ys, zs, ws);

  assert.deepEqual(fromIterator(actual), [15, 38, 61], "summed numbers")
};

exports["test reductions"] = assert => {
  let sum = (...xs) => xs.reduce((x, y) => x + y, 0)

  assert.deepEqual(fromIterator(reductions(sum, [1, 1, 1, 1])),
                   [1, 2, 3, 4],
                   "works with arrays");
  assert.deepEqual(fromIterator(reductions(sum, 5, [1, 1, 1, 1])),
                   [5, 6, 7, 8, 9],
                   "array with initial");

  assert.deepEqual(fromIterator(reductions(sum, seq(function*() {
    yield 1;
    yield 2;
    yield 3;
  }))),
  [1, 3, 6],
  "works with sequences");

  assert.deepEqual(fromIterator(reductions(sum, 10, seq(function*() {
    yield 1;
    yield 2;
    yield 3;
  }))),
  [10, 11, 13, 16],
  "works with sequences");

  assert.deepEqual(fromIterator(reductions(sum, [])), [0],
                   "invokes accumulator with no args");
};

exports["test reduce"] = assert => {
 let sum = (...xs) => xs.reduce((x, y) => x + y, 0)

  assert.deepEqual(reduce(sum, [1, 2, 3, 4, 5]),
                   15,
                   "works with arrays");

  assert.deepEqual(reduce(sum, seq(function*() {
                     yield 1;
                     yield 2;
                     yield 3;
                   })),
                   6,
                   "works with sequences");

  assert.deepEqual(reduce(sum, 10, [1, 2, 3, 4, 5]),
                   25,
                   "works with array & initial");

  assert.deepEqual(reduce(sum, 5, seq(function*() {
                     yield 1;
                     yield 2;
                     yield 3;
                   })),
                   11,
                   "works with sequences & initial");

  assert.deepEqual(reduce(sum, []), 0, "reduce with no args");
  assert.deepEqual(reduce(sum, "a", []), "a", "reduce with initial");
  assert.deepEqual(reduce(sum, 1, [1]), 2, "reduce with single & initial");
};

exports["test count"] = assert => {
  assert.equal(count(null), 0, "null counts to 0");
  assert.equal(count(), 0, "undefined counts to 0");
  assert.equal(count([]), 0, "empty array");
  assert.equal(count([1, 2, 3]), 3, "non-empty array");
  assert.equal(count(""), 0, "empty string");
  assert.equal(count("hello"), 5, "non-empty string");
  assert.equal(count(new Map()), 0, "empty map");
  assert.equal(count(new Map([[1, 2], [2, 3]])), 2, "non-empty map");
  assert.equal(count(new Set()), 0, "empty set");
  assert.equal(count(new Set([1, 2, 3, 4])), 4, "non-empty set");
  assert.equal(count(seq(function*() {})), 0, "empty sequence");
  assert.equal(count(seq(function*() { yield 1; yield 2; })), 2,
               "non-empty sequence");
};

exports["test isEmpty"] = assert => {
  assert.equal(isEmpty(null), true, "null is empty");
  assert.equal(isEmpty(), true, "undefined is empty");
  assert.equal(isEmpty([]), true, "array is array");
  assert.equal(isEmpty([1, 2, 3]), false, "array isn't empty");
  assert.equal(isEmpty(""), true, "string is empty");
  assert.equal(isEmpty("hello"), false, "non-empty string");
  assert.equal(isEmpty(new Map()), true, "empty map");
  assert.equal(isEmpty(new Map([[1, 2], [2, 3]])), false, "non-empty map");
  assert.equal(isEmpty(new Set()), true, "empty set");
  assert.equal(isEmpty(new Set([1, 2, 3, 4])), false , "non-empty set");
  assert.equal(isEmpty(seq(function*() {})), true, "empty sequence");
  assert.equal(isEmpty(seq(function*() { yield 1; yield 2; })), false,
               "non-empty sequence");
};

exports["test isEvery"] = assert => {
  let isOdd = x => x % 2
  let isTrue = x => x === true
  let isFalse = x => x === false

  assert.equal(isEvery(isOdd, seq(function*() {
    yield 1;
    yield 3;
    yield 5;
  })), true, "all are odds");

  assert.equal(isEvery(isOdd, seq(function*() {
    yield 1;
    yield 2;
    yield 3;
  })), false, "contains even");

  assert.equal(isEvery(isTrue, seq(function*() {})), true, "true if empty")
  assert.equal(isEvery(isFalse, seq(function*() {})), true, "true if empty")

  assert.equal(isEvery(isTrue, null), true, "true for null");
  assert.equal(isEvery(isTrue, undefined), true, "true for undefined");
};

exports["test some"] = assert => {
  let isOdd = x => x % 2
  let isTrue = x => x === true
  let isFalse = x => x === false

  assert.equal(some(isOdd, seq(function*() {
    yield 2;
    yield 4;
    yield 6;
  })), null, "all are even");

  assert.equal(some(isOdd, seq(function*() {
    yield 2;
    yield 3;
    yield 4;
  })), true, "contains odd");

  assert.equal(some(isTrue, seq(function*() {})), null,
               "null if empty")
  assert.equal(some(isFalse, seq(function*() {})), null,
               "null if empty")

  assert.equal(some(isTrue, null), null, "null for null");
  assert.equal(some(isTrue, undefined), null, "null for undefined");
};

exports["test take"] = assert => {
  let xs = seq(function*() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
    yield 6;
  });

  assert.deepEqual(fromIterator(take(3, xs)), [1, 2, 3], "took 3 items");
  assert.deepEqual(fromIterator(take(3, [1, 2, 3, 4, 5])), [1, 2, 3],
                   "took 3 from array");

  let ys = seq(function*() { yield 1; yield 2; });
  assert.deepEqual(fromIterator(take(3, ys)), [1, 2], "takes at max n");
  assert.deepEqual(fromIterator(take(3, [1, 2])), [1, 2],
                   "takes at max n from arary");

  let empty = seq(function*() {})
  assert.deepEqual(fromIterator(take(5, empty)), [], "nothing to take");
};

exports["test iterate"] = assert => {
  let inc = x => x + 1
  let nums = iterate(inc, 0)

  assert.deepEqual(fromIterator(take(5, nums)), [0, 1, 2, 3, 4], "took 5");
  assert.deepEqual(fromIterator(take(10, nums)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "took 10");

  let xs = iterate(x => x * 3, 2)
  assert.deepEqual(fromIterator(take(4, xs)), [2, 6, 18, 54], "took 4");
};

exports["test takeWhile"] = assert => {
  let isNegative = x => x < 0
  let xs = seq(function*() {
    yield -2;
    yield -1;
    yield 0;
    yield 1;
    yield 2;
    yield 3;
  });

  assert.deepEqual(fromIterator(takeWhile(isNegative, xs)), [-2, -1],
                   "took until 0");

  let ys = seq(function*() {})
  assert.deepEqual(fromIterator(takeWhile(isNegative, ys)), [],
                   "took none");

  let zs = seq(function*() {
    yield 0;
    yield 1;
    yield 2;
    yield 3;
  });

  assert.deepEqual(fromIterator(takeWhile(isNegative, zs)), [],
                   "took none");
};

require("sdk/test").run(exports);