/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Class } = require('api-utils/heritage');
const listNS = require('api-utils/namespace').ns();

const List = Class({
  /**
   * List constructor can take any number of element to populate itself.
   * @params {Object|String|Number} element
   * @example
   *    List(1,2,3).length == 3 // true
   */
  initialize: function List() {
    listNS(this).keyValueMap = [];

    let _add = listNS(this).add = function _add(value) {
      let list = listNS(this).keyValueMap,
          index = list.indexOf(value);

      if (-1 === index) {
        try {
          this[this.length] = value;
        }
        catch (e) {}
        list.push(value);
      }
    }.bind(this);

    for (let i = 0, ii = arguments.length; i < ii; i++)
      _add(arguments[i]);

    let _remove = listNS(this).remove = function _remove(element) {
      let list = listNS(this).keyValueMap,
          index = list.indexOf(element);

      if (0 <= index) {
        list.splice(index, 1);
        try {
          for (let length = list.length; index < length; index++)
            this[index] = list[index];
          this[list.length] = undefined;
        }
        catch(e){}
      }
    }.bind(this);
  },
  /**
   * Number of elements in this list.
   * @type {Number}
   */
  get length() listNS(this).keyValueMap.length,
   /**
    * Returns a string representing this list.
    * @returns {String}
    */
  toString: function toString() 'List(' + listNS(this).keyValueMap + ')',
  /**
   * Custom iterator providing `List`s enumeration behavior.
   * We cant reuse `_iterator` that is defined by `Iterable` since it provides
   * iteration in an arbitrary order.
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Statements/for...in
   * @param {Boolean} onKeys
   */
  __iterator__: function __iterator__(onKeys, onKeyValue) {
    let array = listNS(this).keyValueMap.slice(0),
                i = -1;
    for each(let element in array)
      yield onKeyValue ? [++i, element] : onKeys ? ++i : element;
  }
});
exports.List = List;
exports.listNS = listNS;
