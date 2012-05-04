/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Function creates a new namespace. Optionally `prototype` object may be
 * passed, in which case namespace objects will inherit from it. Returned value
 * is a function that can be used to get access to the namespaced properties
 * for the passed object.
 * @examples
 *    const ns = Namespace();
 *    ns(myObject).secret = secret;
 */
exports.Namespace = function Namespace(prototype) {
  prototype = prototype || Object.prototype;
  const map = new WeakMap();
  return function namespace(target) {
    return map.get(target) ||
           map.set(target, Object.create(prototype)), map.get(target);
  };
};

// `Namespace` is a e4x function in the scope, so we export the function also as
// `ns` as alias to avoid clashing.
exports.ns = exports.Namespace;
