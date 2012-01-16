/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

const { merge, override, supplement, extend,
        filter, pick } = require('api-utils/utils/object');

exports['test merge strategy'] = function(assert) {
  let a = { p: 'a' }, b = { p: 'b' }, c = { p: 'c' }


  assert.deepEqual(merge(function(name, old, current) {
    return current === b
  }, {}, a, b, c), b, 'properties merged according to given strategy');

  assert.deepEqual(merge(function(name, old, current) {
    return current === b
  }, {}, b, c, a), b, 'properties merged according to strategy');

  assert.deepEqual(merge(function(name, old, current) {
    return current === b
  }, {}, a, c, b), b, 'properties merged according to given strategy');
};

exports['test override'] = function(assert) {
  let actual = override({ a: 1, b: 1, c: 1 },
    { a: 2, d: 2, e: 2 },
    { c: 3, e: 3, f: 3 });

  assert.deepEqual(actual, { a: 2, b: 1, c: 3, d: 2, e: 3, f: 3 },
                   'overrides from left to right');
};

exports['test supplement'] = function(assert) {
  let actual = supplement({ a: 1, b: 1, c: 1 },
    { a: 2, d: 2, e: 2 },
    { c: 3, e: 3, f: 3 });

  assert.deepEqual(actual, { a: 1, b: 1, c: 1, d: 2, e: 2, f: 3 },
                   'supplements from left to right');
};

exports['test override return value'] = function(assert) {
  let f0 = Object.create(null)
  let f1 = override(f0, { a: 1, b: 1 });

  assert.equal(f1, f0, 'first arg is return value');

  let f2 = override(f1, { a: 2 });
  assert.equal(f2, f1, 'first arg is return value');
};

exports['test extend'] = function(assert) {
  let base = Object.create(Object.prototype)
  let actual = extend(base, { a: 1, b: 1 }, { b: 2 }, { c: 3 });

  assert.equal(Object.getPrototypeOf(actual), base,
               "first argument to base is a prototype");
  assert.deepEqual(actual, { a: 1, b: 2, c: 3 },
                   "all properties are defined on result");
};

exports['test filter'] = function(assert) {
  let base = Object.create({ a: 1, b: 1 })
  let source = Object.create(base);
  source.c = 2
  source.d = 2
  source.aa = 12

  let actual = filter(function(name) { return name.length === 1 }, source);

  assert.deepEqual(actual, { c: 2, d: 2 }, 'only own properties are filetered');
  assert.equal(Object.getPrototypeOf(actual), base, 'prototype is preserved');
};

exports['test pick'] = function(assert) {
  let base = { a: 1, b: 1, c: 1 }
  let source = extend(base, { c: 2, d: 2 }, { e: 3, a: 3 }, { f: 4 });
  let actual = pick([ 'a', 'b', 'f', 'g', 'toString' ], source);

  assert.deepEqual(actual, { a: 3, f: 4 }, 'picked all own properties');
  assert.equal(Object.getPrototypeOf(actual), base, 'prototype is preserved');
}

require('test').run(exports)
