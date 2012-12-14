/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { List, addListItem, removeListItem,
        hasListItem } = require('sdk/util/list');
const { Class } = require('sdk/core/heritage');

exports.testList = function(assert) {
  let list = List();
  addListItem(list, 1);

  for (let key in list) {
    assert.equal(key, 0, 'key is correct');
    assert.equal(list[key], 1, 'value is correct');
  }

  assert.ok(hasListItem(list, 1), 'list has added item');
  assert.ok(!hasListItem(list, 2), 'list does not has item that was not added');

  addListItem(list, 1);
  assert.equal(list.length, 1, 'items are not added if already there');


  let count = 0;
  for each (let ele in list) {
    assert.equal(ele, 1, 'ele is correct');
    assert.equal(++count, 1, 'count is correct');
  }

  removeListItem(list, 1);
  assert.ok(!hasListItem(list, 1), 'list no longer has item that was removed');
  assert.equal(list.length, 0, 'remove worked');
};

exports.testImplementsList = function(assert) {
  let List2 = Class({
    implements: [List],
    initialize: function() {
      List.prototype.initialize.apply(this, [0, 1, 2]);
    }
  });

  let list2 = List2();
  let count = 0;
  for each (let ele in list2) {
    assert.equal(ele, count++, 'ele is correct');
  }

  assert.equal(list2.length, 3, 'list has three items');
  addListItem(list2, 3);

  assert.equal(list2.length, 4, '3 was added');
  assert.equal(list2[list2.length-1], 3, '3 was added');
};

exports.testArrayMethods = function(assert) {
  let list = List(-3, -2, -1, 0, 1, 2, 3, 4, 5);
  let result = list.filter(function(x) x >= 0).
                    map(function(x) x * x).
                    reduce(function(sum, x) sum + x);

  assert.equal(result, 55, "array methods chained");


  assert.deepEqual(List(1, 2, 3, 4).reverse(),
                   [4, 3, 2, 1],
                   "list is reversed");
};

require("test").run(exports);
