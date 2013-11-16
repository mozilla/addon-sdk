/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { seq, iterate, filter, map, reductions, reduce, count,
      isEmpty, every, isEvery, some, take, takeWhile, drop,
      dropWhile, concat, first, rest, nth, last, dropLast,
      distinct, remove, mapcat
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

exports["test drop"] = assert => {
  let testDrop = xs => {
    assert.deepEqual(fromIterator(drop(2, xs)),
                     [3, 4],
                     "dropped two elements");

    assert.deepEqual(fromIterator(drop(1, xs)),
                     [2, 3, 4],
                     "dropped one");

    assert.deepEqual(fromIterator(drop(0, xs)),
                     [1, 2, 3, 4],
                     "dropped 0");

    assert.deepEqual(fromIterator(drop(-2, xs)),
                     [1, 2, 3, 4],
                     "dropped 0 on negative `n`");

    assert.deepEqual(fromIterator(drop(5, xs)),
                     [],
                     "dropped all items")
  }

  testDrop([1, 2, 3, 4])
  testDrop(seq(function*() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
  }));
};


exports["test dropWhile"] = assert => {
  let isNegative = x => x < 0
  let True = _ => true
  let False = _ => false

  let test = xs => {
    assert.deepEqual(fromIterator(dropWhile(isNegative, xs)),
                     [0, 1, 2],
                     "dropped negative");

    assert.deepEqual(fromIterator(dropWhile(True, xs)),
                     [],
                     "drop all");

    assert.deepEqual(fromIterator(dropWhile(False, xs)),
                     [-2, -1, 0, 1, 2],
                     "keep all");
  }

  test([-2, -1, 0, 1, 2]);
  test(seq(function*() {
    yield -2;
    yield -1;
    yield 0;
    yield 1;
    yield 2;
  }));
};


exports["test concat"] = assert => {
  let test = (a, b, c, d) => {
    assert.deepEqual(fromIterator(concat()),
                     [],
                     "nothing to concat");
    assert.deepEqual(fromIterator(concat(a)),
                     [1, 2, 3],
                     "concat with nothing returns same as first");
    assert.deepEqual(fromIterator(concat(a, b)),
                     [1, 2, 3, 4, 5],
                     "concat items from both");
    assert.deepEqual(fromIterator(concat(a, b, a)),
                     [1, 2, 3, 4, 5, 1, 2, 3],
                     "concat itself");
    assert.deepEqual(fromIterator(concat(c)),
                     [],
                     "concat of empty is empty");
    assert.deepEqual(fromIterator(concat(a, c)),
                     [1, 2, 3],
                     "concat with empty");
    assert.deepEqual(fromIterator(concat(c, c, c)),
                     [],
                     "concat of empties is empty");
    assert.deepEqual(fromIterator(concat(c, b)),
                     [4, 5],
                     "empty can be in front");
    assert.deepEqual(fromIterator(concat(d)),
                     [7],
                     "concat singular");
    assert.deepEqual(fromIterator(concat(d, d)),
                     [7, 7],
                     "concat singulars");

    assert.deepEqual(fromIterator(concat(a, a, b, c, d, c, d, d)),
                     [1, 2, 3, 1, 2, 3, 4, 5, 7, 7, 7],
                     "many concats");

    let ab = concat(a, b)
    let abcd = concat(ab, concat(c, d))
    let cdabcd = concat(c, d, abcd)

    assert.deepEqual(fromIterator(cdabcd),
                     [7, 1, 2, 3, 4, 5, 7],
                     "nested concats")
  };

  test([1, 2, 3],
       [4, 5],
       [],
       [7]);

  test(seq(function*() { yield 1; yield 2; yield 3; }),
       seq(function*() { yield 4; yield 5; }),
       seq(function*() { }),
       seq(function*() { yield 7; }));
};


exports["test first"] = assert => {
  let test = (xs, empty) => {
    assert.equal(first(xs), 1, "returns first")
    assert.equal(first(empty), null, "returns null empty")
  }

  test("1234", "");
  test([1, 2, 3], []);
  test([1, 2, 3], null);
  test([1, 2, 3], undefined);
  test(seq(function*() { yield 1; yield 2; yield 3; }),
       seq(function*() { }));
};

exports["test rest"] = assert => {
  let test = (xs, x, nil) => {
    assert.deepEqual(fromIterator(rest(xs)), ["b", "c"],
                     "rest items");
    assert.deepEqual(fromIterator(rest(x)), [],
                     "empty when singular");
    assert.deepEqual(fromIterator(rest(nil)), [],
                     "empty when empty");
  }

  test("abc", "a", "");
  test(["a", "b", "c"], ["d"], []);
  test(seq(function*() { yield "a"; yield "b"; yield "c"; }),
       seq(function*() { yield "d"; }),
       seq(function*() {}));
  test(["a", "b", "c"], ["d"], null);
  test(["a", "b", "c"], ["d"], undefined);
};


exports["test nth"] = assert => {
  let notFound = {}
  let test = xs => {
    assert.equal(nth(xs, 0), "h", "first");
    assert.equal(nth(xs, 1), "e", "second");
    assert.equal(nth(xs, 5), void(0), "out of bound");
    assert.equal(nth(xs, 5, notFound), notFound, "out of bound");
    assert.equal(nth(xs, -1), void(0), "out of bound");
    assert.equal(nth(xs, -1, notFound), notFound, "out of bound");
    assert.equal(nth(xs, 4), "o", "5th");
  }

  let testEmpty = xs => {
    assert.equal(nth(xs, 0), void(0), "no first in empty")
    assert.equal(nth(xs, 5), void(0), "no 5th in empty")
    assert.equal(nth(xs, 0, notFound), notFound, "notFound on out of bound")
  }

  test("hello");
  test(["h", "e", "l", "l", "o"]);
  test(seq(function*() {
    yield "h";
    yield "e";
    yield "l";
    yield "l";
    yield "o";
  }));
  testEmpty(null)
  testEmpty(undefined)
  testEmpty([])
  testEmpty("")
  testEmpty(seq(function*() {}))
};


exports["test last"] = assert => {
  assert.equal(last(null), null, "no last in null");
  assert.equal(last(void(0)), null, "no last in undefined");
  assert.equal(last([]), null, "no last in []");
  assert.equal(last(""), null, "no last in ''");
  assert.equal(last(seq(function*() { })), null, "no last in empty");

  assert.equal(last("hello"), "o", "last from string");
  assert.equal(last([1, 2, 3]), 3, "last from array");
  assert.equal(last([1]), 1, "last from singular");
  assert.equal(last(seq(function*() {
    yield 1;
    yield 2;
    yield 3;
  })), 3, "last from sequence");
};


exports["test dropLast"] = assert => {
  let test = xs => {
    assert.deepEqual(fromIterator(dropLast(xs)),
                     [1, 2, 3, 4],
                     "dropped last");
    assert.deepEqual(fromIterator(dropLast(0, xs)),
                     [1, 2, 3, 4, 5],
                     "dropped none on 0");
    assert.deepEqual(fromIterator(dropLast(-3, xs)),
                     [1, 2, 3, 4, 5],
                     "drop none on negative");
    assert.deepEqual(fromIterator(dropLast(3, xs)),
                     [1, 2],
                     "dropped given number");
    assert.deepEqual(fromIterator(dropLast(5, xs)),
                     [],
                     "dropped all");
  }

  let testEmpty = xs => {
    assert.deepEqual(fromIterator(dropLast(xs)),
                     [],
                     "nothing to drop");
    assert.deepEqual(fromIterator(dropLast(0, xs)),
                     [],
                     "dropped none on 0");
    assert.deepEqual(fromIterator(dropLast(-3, xs)),
                     [],
                     "drop none on negative");
    assert.deepEqual(fromIterator(dropLast(3, xs)),
                     [],
                     "nothing to drop");
  }

  test([1, 2, 3, 4, 5]);
  test(seq(function*() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
  }));
  testEmpty([]);
  testEmpty("");
  testEmpty(seq(function*() {}));
};


exports["test distinct"] = assert => {
  let test = xs => {
    assert.deepEqual(fromIterator(distinct(xs)),
                     [1, 2, 3, 4, 5],
                     "only unique items are present")
  }

  test([1, 2, 1, 3, 1, 4, 1, 5]);
  test(seq(function*() {
    yield 1;
    yield 2;
    yield 1;
    yield 3;
    yield 1;
    yield 4;
    yield 1;
    yield 5;
  }));
};


exports["test remove"] = assert => {
  let isPositive = x => x > 0
  let test = xs => {
    assert.deepEqual(fromIterator(remove(isPositive, xs)),
                     [-2, -1, 0],
                     "removed positives");
  }

  test([1, -2, 2, -1, 3, 7, 0]);
  test(seq(function*() {
    yield 1;
    yield -2;
    yield 2;
    yield -1;
    yield 3;
    yield 7;
    yield 0;
  }));
};


exports["test mapcat"] = assert => {
  let upto = n => seq(function* () {
    let index = 0;
    while (index < n) {
      yield index;
      index = index + 1;
    }
  });

  assert.deepEqual(fromIterator(mapcat(upto, [1, 2, 3, 4])),
                   [0, 0, 1, 0, 1, 2, 0, 1, 2, 3],
                   "expands given sequence");

  assert.deepEqual(fromIterator(mapcat(upto, [0, 1, 2, 0])),
                   [0, 0, 1],
                   "expands given sequence");

  assert.deepEqual(fromIterator(mapcat(upto, [0, 0, 0])),
                   [],
                   "expands given sequence");

  assert.deepEqual(fromIterator(mapcat(upto, [])),
                   [],
                   "nothing to expand");

  assert.deepEqual(fromIterator(mapcat(upto, null)),
                   [],
                   "nothing to expand");

  assert.deepEqual(fromIterator(mapcat(upto, void(0))),
                   [],
                   "nothing to expand");

  let xs = seq(function*() {
    yield 0;
    yield 1;
    yield 0;
    yield 2;
    yield 0;
  });

  assert.deepEqual(fromIterator(mapcat(upto, xs)),
                   [0, 0, 1],
                   "expands given sequence");
};

require("sdk/test").run(exports);
