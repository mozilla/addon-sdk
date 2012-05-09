/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Merges all the properties of all arguments into first argument. If two or
 * more argument objects have own properties with the same name, the property
 * is will be either overridden or supplemented depending on merge strategy,
 * which may be given as `this` pseudo variable. If strategy is not specified
 * then override is used, implying, that properties of the object on the left
 * are overridden by a same named property of the object on the right.
 * @examples
 *    var a = { bar: 0, a: 'a' }
 *    var b = merge(a, { foo: 'foo', bar: 1 }, { foo: 'bar', name: 'b' });
 *    b === a   // true
 *    b.a       // 'a'
 *    b.foo     // 'bar'
 *    b.bar     // 1
 *    b.name    // 'b'
 */
function merge(strategy, source) {
  let descriptor = {}, merged = {};
  if (typeof(strategy) !== 'function') {
    console.warn('Please use override instead of merge');
    return override.apply(null, arguments);
  }

  Array.slice(arguments, 1).forEach(function onEach(source) {
    Object.getOwnPropertyNames(source).forEach(function(name) {
      // If there is no conflict or if it's override strategy:
      if (!(name in merged) || strategy(name, merged[name], source)) {
        merged[name] = source;
        descriptor[name] = Object.getOwnPropertyDescriptor(source, name);
      }
    });
  });
  return Object.defineProperties(source, descriptor);
}
exports.merge = merge;


/**
 * Merges all the properties of the arguments into first arguments with an
 * override strategy.
 */
function override(source) {
  return merge.apply(null, [ function() true ].concat(Array.slice(arguments)));
}
exports.override = override;

/**
 * Merges all the properties of the arguments into first arguments with
 * a supplement strategy.
 */
function supplement(source) {
  return merge.apply(null, [ function() false ].concat(Array.slice(arguments)));
}
exports.supplement = supplement;

/**
 * Returns an object that inherits from the first argument and contains all the
 * properties from all following arguments.
 * `extend(source1, source2, source3)` is equivalent of
 * `merge(Object.create(source1), source2, source3)`.
 */
function extend(source) {
  let rest = Array.slice(arguments, 1);
  rest.unshift(Object.create(source));
  return override.apply(null, rest);
}
exports.extend = extend;

/**
 * Return an object that inherits from the given object's ancestor and contains
 * only properties that `fn` returned true on.
 */
function filter(fn, source) {
  let descriptor = {}
  Object.getOwnPropertyNames(source).forEach(function(name) {
    if (fn(name, source))
      descriptor[name] = Object.getOwnPropertyDescriptor(source, name);
  });
  return Object.create(Object.getPrototypeOf(source), descriptor);
}
exports.filter = filter;

/**
 * Returns an obtain that inherits from the given object's ancestor and contains
 * only properties that are listed in the given `names` array.
 */
function pick(names, source) {
  return filter(function(name) {
    return ~names.indexOf(name)
  }, source);
}
exports.pick = pick;
