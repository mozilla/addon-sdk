'use strict';

const { map, has, get, set, unset  } = require('api-utils/collections/map');

exports['test basic'] = function(assert) {
  let m1 = map({});
  assert.equal(set(m1, 'foo?', 'foo!'), undefined, 'set does not returns');
  assert.equal(get(m1, 'foo?'), 'foo!', 'get returns value that was set');
  assert.equal(get(m1, 'foo?', 'bar'), 'foo!', 'get returns associated value');
  assert.equal(get(m1, 'bar?', 'bar!'), 'bar!',
               'get returns fallback value if not found');
  set(m1, 'nil');
  assert.equal(get(m1, 'nil', 'boom'), undefined,
               'get returns undefined if associated');
};

exports['test has'] = function(assert) {
  let m1 = map({}), key = {}, value = {};
  assert.equal(has(m1, key), false, 'has returns false');
  set(m1, key, value);
  assert.equal(has(m1, key), true, 'has returns true');
};

exports['test get'] = function(assert) {
  let m1 = map({}), key = {}, value = {}, fallback = {};

  assert.equal(get(m1, key), undefined, 'returns undefiend if not there');
  assert.equal(get(m1, key, fallback), fallback,
               'returns fallback if provided');
  set(m1, key, value);
  assert.equal(get(m1, key), value, 'returns value set');
  assert.equal(get(m1, key, fallback), value,
               'returns value set even with fallback');
};

exports['test unset'] = function(assert) {
  let m1 = map({}), key = {}, value = {}, fallback = {};
  assert.equal(has(m1, key), false, 'has no value set');
  assert.equal(unset(m1, key), undefined, 'returns undefined on unset');
  set(m1, key, value);
  assert.equal(has(m1, key), true, 'value is set');
  assert.equal(unset(m1, key), undefined, 'returns undefined no unset (set)');
  assert.equal(has(m1, key), false, 'value was removed');
};

exports['test set'] = function(assert) {
  let m1 = map({}), key = {}, v1 = {}, v2 = {}, v3 = {}
  assert.equal(has(m1, key), false, 'value is not set yet');
  assert.equal(set(m1, key, v1), undefined, 'set value (no return)');
  assert.equal(get(m1, key), v1, 'value set');
  assert.equal(unset(m1, key, v1), undefined, 'unset value');
  assert.equal(has(m1, key), false, 'key removed');
  assert.equal(get(m1, key), undefined, 'value unset');
  assert.equal(set(m1, key, v2), undefined, 'set diff value');
  assert.equal(get(m1, key), v2, 'new value set');
  assert.equal(set(m1, key, v3), undefined, 'override value');
  assert.equal(get(m1, key), v3, 'value overriden');
  assert.equal(set(m1, key), undefined, 'set value to undefined');
  assert.equal(get(m1, key), undefined, 'value set to undefined');
  assert.equal(has(m1, key), true, 'value is set');
  assert.equal(unset(m1, key), undefined, 'unset value');
  assert.equal(has(m1, key), false, 'value is unset');
};

require("test").run(exports);
