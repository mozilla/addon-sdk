/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This is a temporary workaround until bug 673468 is fixed, which causes
// entries associated with `XPCWrappedNative` wrapped keys to be GC-ed. To
// workaround that we create a cross reference with an object from the same
// compartment as `WeakMap` and use that as a key. Cross reference prevents
// wrapper to be GC-ed until reference to it's value is kept.
function handle(target) {
  return target[handle.key] || Object.defineProperty(target, handle.key, {
    value: { '::': target },
    enumerable: false,
    configurable: false,
    writable: false
  })[handle.key];
}
handle.key = '::ns::' + Math.round(Math.random() * 100000000000000000);

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
    let key = handle(target);
    return map.get(key) ||
           map.set(key, Object.create(prototype)), map.get(key);
  };
};

// `Namespace` is a e4x function in the scope, so we export the function also as
// `ns` as alias to avoid clashing.
exports.ns = exports.Namespace;
