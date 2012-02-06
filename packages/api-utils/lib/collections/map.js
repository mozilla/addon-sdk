/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

let { Namespace } = require('../namespace');

const Map = Namespace();

/**
 * Implement namespaced map abstraction under the given `source` object.
 */
exports.map = function map(source, options) {
  let map = Map(source);
  options = options || {};
  map.keys = [];
  map.values = [];
  map.length = 'length' in options ? options.length || Infinity : Infinity;
  return source;
};

exports.unset = function unset(source, key) {
  let { keys, values } = Map(source);
  let index = keys.indexOf(key);
  if (~index) {
    keys.splice(index, 1);
    values.splice(index, 1);
  }
};

exports.has = function has(source, key) {
  let { keys } = Map(source);
  return !!~keys.indexOf(key);
};

exports.get = function get(source, key, fallback) {
  let { keys, values } = Map(source);
  let index = keys.indexOf(key);
  return ~index ? values[index] : fallback;
};

exports.set = function set(source, key, value) {
  let { keys, values, length } = Map(source);
  let index = keys.indexOf(key);
  if (!~index) {
    if (keys.length === length) {
      keys.shift();
      values.shift();
    }
    keys.push(key);
    values.push(value);
  } else {
    keys.splice(index, 1, key);
    values.splice(index, 1, value);
  }
};
