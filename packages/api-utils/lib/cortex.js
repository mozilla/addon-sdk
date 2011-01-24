/* vim:set ts=2 sw=2 sts=2
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original author)
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

"use strict";

// `var` is being used in the module in order to make it reusable in
// environments in which `let` and `const` is not yet supported.

// Returns `object`'s property value, where `name` is a name of the property.
function get(object, name) {
  return object[name];
}

// Assigns `value` to the `object`'s property, where `name` is a name of the
// property.
function set(object, name, value) {
  return object[name] = value;
}

// Function takes `object` containing property with the given `name` and
// creates alias property descriptor that can be used to define alias / proxy
// properties on other objects. Value change on any alias will propagate to the
// aliased property and other way round.
function createAliasProperty(object, name) {
  // Getting own property descriptor of an `object` for the given `name` as
  // we are going to create proxy analog.
  var property = Object.getOwnPropertyDescriptor(object, name);
  var descriptor = {
    configurable: property.configurable,
    enumerable: property.enumerable,
    alias: true
  };
  // If original property has a getter using it's `object` bounded copy.
  // This way `this` pseudo-variable will alway be a `object`.
  if ("get" in property)
    descriptor.get = property.get.bind(object);
  // If original property has a setter using it's `object` bounded copy.
  if ("set" in property)
    descriptor.set = property.set.bind(object)
  
  // If original property was a value property.
  if ("value" in property) {
    // If original property is a method using it's `object` bounded copy.
    if (typeof property.value === "function") {
      descriptor.value = property.value.bind(object);
      // Also preserving writability of the original property.
      descriptor.writable = property.writable;
    }
    // If original property was just a data property we create a proxy
    // accessors to it propagate to changes to the original `object` and
    // other way round.
    else {
      descriptor.get = get.bind(null, object, name);
      descriptor.set = set.bind(null, object, name);
    }
  }
  return descriptor;
}
exports.createAliasProperty = createAliasProperty;

// Defines property on `object` object with a name `alias` if given if not
// defaults to `name` that represents an alias of `source[name]`. If aliased
// property was an assessor or a method `this` pseudo-variable will be `source`
// when invoked. If aliased property was a data property changes on any of the
// aliases will propagate to the `source[name]` and also other way round.
function defineAlias(target, source, name, alias) {
  return Object.defineProperty(target, alias || name,
                                       createAliasProperty(source, name));
}
exports.defineAlias = defineAlias;

exports.cortex = function cortex(object, names, prototype) {
  // Creating a cortex object from the given `prototype`, if one was not
  // provided then `prototype` of a given `object` is used. This allows
  // consumer to define expected behavior `instanceof`. In common case
  // `prototype` argument can be omitted to preserve same behavior of
  // `instanceof` as on original `object`.
  var cortex = Object.create(prototype || Object.getPrototypeOf(object));
  // Creating alias properties on the `cortex` object for all the own
  // properties of the original `object` that are contained in `names` array.
  // If `names` array is not provided then all the properties that don't
  // start with `"_"` are aliased.
  Object.getOwnPropertyNames(object).forEach(function (name) {
    if ((!names && "_" !== name.charAt(0)) || (names && ~names.indexOf(name)))
      defineAlias(cortex, object, name);
  });
  return cortex;
}
