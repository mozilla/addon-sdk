/* vim:ts=2:sts=2:sw=2:
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
 *   Irakli Gozalishvili <rfobic@gmail.com> (Original author)
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
// environments in which `let` is not yet supported.

// Shortcut to `Object.prototype.hasOwnProperty.call`.
// owns(object, name) would be the same as
// Object.prototype.hasOwnProperty.call(object, name);
var owns = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

/**
 * Whether or not given property descriptors are equivalent. They are
 * equivalent either if both are marked as 'conflict' or 'required' property
 * or if all the properties of descriptors are equal.
 * @param {Object} actual
 * @param {Object} expected
 */
function equivalentDescriptors(actual, expected) {
  return (actual.conflict && expected.conflict) ||
         (actual.required && expected.required) ||
         equalDescriptors(actual, expected);
}
/**
 * Whether or not given property descriptors define equal properties.
 */
function equalDescriptors(actual, expected) {
  return actual.get === expected.get &&
         actual.set === expected.set &&
         actual.value === expected.value &&
         (actual.enumerable !== true) === (expected.enumerable !== true) &&
         (actual.configurable !== true) === (expected.configurable !== true) &&
         (actual.writable !== true) === (expected.writable !== true);
}

// Utilities that throwing exceptions for a properties that are marked
// as "required" or "conflict" properties.
function throwConflictPropertyError(name) {
  throw new Error("Remaining conflicting property: `" + name + "`");
}
function throwRequiredPropertyError(name) {
  throw new Error("Missing required property: `" + name + "`");
}

/**
 * Generates custom **required** property descriptor. Descriptor contains
 * non-standard property `required` that is equal to `true`.
 * @param {String} name
 *    property name to generate descriptor for.
 * @returns {Object}
 *    custom property descriptor
 */
function RequiredPropertyDescriptor(name) {
  // Creating function by binding firs argument to a property `name` on the
  // `throwConflictPropertyError` function. Created function is used as a
  // getter & setter of the created property descriptor. This way we ensure
  // that we throw exception late (on property access) if object with
  // `required` property was instantiate using build-in `Object.create`.
  var accessor = throwRequiredPropertyError.bind(null, name);
  return { get: accessor, set: accessor, required: true };
}

/**
 * Generates custom **conflicting** property descriptor. Descriptor contains
 * non-standard property `conflict` that is equal to `true`.
 * @param {String} name
 *    property name to generate descriptor for.
 * @returns {Object}
 *    custom property descriptor
 */
function ConflictPropertyDescriptor(name) {
  // For details see `RequiredPropertyDescriptor` since idea is same.
  var accessor = throwConflictPropertyError.bind(null, name);
  return { get: accessor, set: accessor, conflict: true };
}

/**
 * Tests if property is marked as `required` property.
 */
function isRequiredProperty(object, name) {
  return !!object[name].required;
}

/**
 * Tests if property is marked as `conflict` property.
 */
function isConflictProperty(object, name) {
  return !!object[name].conflict;
}

/**
 * Function tests whether or not method of the `source` object with a given
 * `name` is inherited from `Object.prototype`.
 */
function isBuildInMethod(name, source) {
  var target = Object.prototype[name];

  // If methods are equal then we know it's `true`.
  return target == source ||
  // If `source` object comes form a different sandbox `==` will evaluate
  // to `false`, in that case we check if functions names and sources match.
         (String(target) === String(source) && target.name === source.name);
}

/**
 * Function overrides `toString` and `constructor` methods of a given `target`
 * object with a same named methods of a given `source` if methods of `target`
 * object are inherited / copied form `Object.prototype`.
 * @see create
 */
function overrideBuildInMethods(target, source) {
  if (isBuildInMethod("toString", target.toString)) {
    Object.defineProperty(target, "toString",  {
      value: source.toString,
      configurable: true,
      enumerable: false
    });
  }

  if (isBuildInMethod("constructor", target.constructor)) {
    Object.defineProperty(target, "constructor", {
      value: source.constructor,
      configurable: true,
      enumerable: false
    });
  }
}

/**
 * Composes new trait with the same own properties as the original trait,
 * except that all property names appearing in the first argument are replaced
 * by "required" property descriptors.
 * @param {String[]} keys
 *    Array of strings property names.
 * @param {Object} trait
 *    A trait some properties of which should be excluded.
 * @returns {Object}
 * @example
 *    var newTrait = exclude(["name", ...], trait)
 */
function exclude(names, trait) {
  var composition = Object.create(Trait.prototype);
  Object.keys(trait).forEach(function(name) {

    // If property is not excluded (array of names does not contains it) or
    // it is a "required" property coping it to resulting composition.
    if (0 > names.indexOf(name) || isRequiredProperty(trait, name))
      composition[name] = trait[name];

    // For all the names in the exclude name array we create required
    // property descriptors and copy them to the resulting composition.
    else
      composition[name] = RequiredPropertyDescriptor(name);
  });
  return composition;
}

/**
 * Composes new instance of `Trait` with a properties of a given `trait`,
 * except that all properties whose name is an own property of `renames` will
 * be renamed to `renames[name]` and a `"required"` property for name will be
 * added instead.
 *
 * For each renamed property, a required property is generated. If
 * the `renames` map two properties to the same name, a conflict is generated.
 * If the `renames` map a property to an existing unrenamed property, a
 * conflict is generated.
 *
 * @param {Object} renames
 *    An object whose own properties serve as a mapping from old names to new
 *    names.
 * @param {Object} trait
 *    A new trait with renamed properties.
 * @returns {Object}
 * @example
 *
 *    // Return trait with `bar` property equal to `trait.foo` and with
 *    // `foo` and `baz` "required" properties.
 *    var renamedTrait = rename({ foo: "bar", baz: null }), trait);
 *
 *    // t1 and t2 are equivalent traits
 *    var t1 = rename({a: "b"}, t);
 *    var t2 = compose(exclude(["a"], t), { a: { required: true }, b: t[a] });
 */
function rename(renames, trait) {
  var composition = Object.create(Trait.prototype);

  // Loop over all the properties in the `trait` and copy them to a new trait,
  // renaming them as specified in `renames`.
  Object.keys(trait).forEach(function(name) {
    var alias;

    // If the property is in the `renames` map, and it isn't a "required"
    // property (which should never need to be aliased because "required"
    // properties never conflict), then we must try to rename it.
    if (owns(renames, name) && !isRequiredProperty(trait, name)) {
      alias = renames[name];

      // If the result trait already has the `alias`, and it isn't a "required"
      // property, that means the `alias` conflicts with an existing name for a
      // provided trait (that can happen if >=2 properties are aliased to the
      // same name), so we have to mark it as a conflicting property.
      // Otherwise, everything is fine, so we assign the value to the `alias`
      // in the result trait.
      if (owns(composition, alias) && !isRequiredProperty(composition, alias))
        composition[alias] = ConflictPropertyDescriptor(alias);

      // Add the property under an alias.
      else
        composition[alias] = trait[name];

      // Regardless of whether or not the rename was successful, we check to
      // see if the original name exists in the result trait (such a property
      // could exist if previously other property was aliased to this name).
      // If it doesn't, we mark it as "required", to make sure the caller
      // provides another value for the old name, to which methods of the trait
      // might continue to reference.
      if (!owns(composition, name))
        composition[name] = RequiredPropertyDescriptor(name);
    }

    // Otherwise, either the property isn't in the `renames` map (thus the
    // caller is not trying to rename it) or it is a "required" property.
    // Either way, we don't have to alias the property, we just have to copy it
    // to the result trait.
    else {
      // The property isn't in the result trait yet, so we copy it over.
      if (!owns(composition, name))
        composition[name] = trait[name];

      // The property is already in the result trait (that means another
      // property was aliased with this name, which creates a conflict if
      // a property is not marked as "required", so we have to mark it as
      // a "conflict" property.
      else if (!isRequiredProperty(trait, name))
        composition[name] = ConflictPropertyDescriptor(name);
    }
  });
  return composition;
}

/**
 * Composes new resolved trait, with all the same properties as the original
 * `trait`, except that all properties whose name is an own property of
 * `resolutions` will be renamed to `resolutions[name]`.
 *
 * If `resolutions[name]` is `null` value will be mapped ta a property
 * descriptor that will be marked as "required" property.
 */
function resolve(resolutions, trait) {
    var renames = {};
    var exclusions = [];

    // Go through each mapping in `resolutions` object and distribute it either
    // to `renames` or `exclusions`.
    Object.keys(resolutions).forEach(function(name) {

      // If `resolutions[name]` is a truthy value then it's a mapping old -> new
      // so we copy it to `renames` map.
      if (resolutions[name])
        renames[name] = resolutions[name];

      // Otherwise it's not a mapping but an exclusion instead in which case we
      // add it to the `exclusions` array.
      else
        exclusions.push(name);
    });

    // First `exclude` **then** `rename` and order is important since
    // `exclude` and `rename` are not associative.
    return rename(renames, exclude(exclusions, trait));
}

/**
 * Function composes new trait ("custom" properties descriptor map that
 * inherits from `Trait.prototype`) that represents a map of the property
 * descriptors for the given `object`'s properties. (inherited properties
 * are ignored).
 *
 * Data properties bound to the `Trait.required` singleton exported by
 * this module will be marked as "required" properties.
 *
 * @param {Object} object
 *    Map of properties to compose trait from.
 * @returns {Trait}
 *    Trait / Property descriptor map containing all the own properties of the
 *    given argument.
 */
function trait(object) {
  var composition = object;
  if (!(object instanceof Trait)) {

    // If passed `object` is not already an instance of `Trait` we create
    // one and map own properties of a given `object` to it.
    composition = Object.create(Trait.prototype);

    // Each own property of a given `object` is mapped to a result trait.
    Object.keys(object).forEach(function (name) {

      // If property of an `object` is equal to a `Trait.required`, it means
      // that it was marked as "required" property, in which case we map it
      // to "required" property descriptor on result trait.
      if (Trait.required == Object.getOwnPropertyDescriptor(object, name).value)
        composition[name] = RequiredPropertyDescriptor(name);

      // Otherwise property is mapped to it's property descriptor.
      else
        composition[name] = Object.getOwnPropertyDescriptor(object, name);
    });
  }
  return composition;
}

/**
 * Function composes "custom" properties descriptor map that inherits from
 * `Trait.prototype` and contains property descriptors for all the own
 * properties of the passed traits.
 *
 * If two or more traits have own properties with the same name, returned
 * trait will contain a "conflict" property for that name. "compose" is
 * a commutative and associative operation, and the order of its
 * arguments is irrelevant.
 */
function compose(trait1, trait2/*, ...*/) {

  // Creating new instance of `Trait` that will be result of this
  // composition and target to which all properties will be copied.
  var composition = Object.create(Trait.prototype);

  // Properties of each passed trait are copied to the resulting trait.
  Array.prototype.forEach.call(arguments, function(trait) {
    // Coping each property of the given trait.
    Object.keys(trait).forEach(function(name) {

      // If composition already owns a property with the `name` that is
      // not a requirement (that is will be satisfied)
      if (owns(composition, name) && !isRequiredProperty(composition, name)) {

        // and if property being copied is neither requirement (that is already
        // satisfied) nor an equal property, conflict property is created.
        if (!isRequiredProperty(trait, name) &&
            !equivalentDescriptors(composition[name], trait[name])
        )
          composition[name] = ConflictPropertyDescriptor(name);
      }

      // If composition does not owns a property with the `name` that is not
      // a requirement (that will be resolved) property from the source trait
      // is copied.
      else {
        composition[name] = trait[name];
      }
    });
  });

  return composition;
}

/**
 *  `defineProperties` is like `Object.defineProperties`, except that it
 *  ensures that:
 *    - An exception is thrown if any property in a given `properties` map
 *      is marked as "required" property and same named property is not
 *      found in a given `prototype`.
 *    - An exception is thrown if any property in a given `properties` map
 *      is marked as "conflict" property.
 * @param {Object} object
 *    Object to define properties on.
 * @param {Object} properties
 *    Properties descriptor map.
 * @returns {Object}
 *    `object` that was passed as a first argument.
 */
function defineProperties(object, properties) {

  // Creating map where we will copy each verified property form the given
  // `properties` descriptor map. We need verify that non of the provided
  // properties is marked as "conflict" property and that we don't have
  // a property marked as "required" which is not resolved by an `object`
  // property before defining any properties, in order to throw exception
  // before mutating an object.
  var verifiedProperties = {};

  // Coping each property from a given `properties` descriptor map to a
  // verified map of property descriptors.
  Object.keys(properties).forEach(function(name) {

    // If property is marked as "required" property and we don't have a same
    // named property in a given `object` we throw an exception. If `object`
    // has same named property just skip this property since required property
    // is was inherited and there for requirement was satisfied.
    if (isRequiredProperty(properties, name)) {
      if (!(name in object))
        throwRequiredPropertyError(name);
    }

    // If property is marked as "conflict" property we throw an exception.
    else if (isConflictProperty(properties, name)) {
      throwConflictPropertyError(name);
    }

    // If property is not marked neither as "required" nor "conflict" property
    // we copy it to verified properties map.
    else {
      verifiedProperties[name] = properties[name];
    }
  });

  // If no exceptions was thrown yet we know that our verified property
  // descriptor map has no properties marked as "conflict" or "required"
  // so we just delegate to build-in "Object.defineProperties".
  return Object.defineProperties(object, verifiedProperties);
}

/**
 *  `create` is like `Object.create`, except that it ensures that:
 *    - An exception is thrown if any property in a given `properties` map
 *      is marked as "required" property and same named property is not
 *      found in a given `prototype`.
 *    - An exception is thrown if any property in a given `properties` map
 *      is marked as "conflict" property.
 * @param {Object} prototype
 *    prototype of the composed object
 * @param {Object} properties
 *    Properties descriptor map.
 * @returns {Object}
 *    An object that inherits form a given `prototype` and implements all the
 *    properties defined by a given `properties` descriptor map.
 */
function create(prototype, properties) {

  // Creating an instance of the given `prototype`.
  var object = Object.create(prototype);

  // Overriding `toString`, `constructor` methods if they are just inherited
  // from `Object.prototype` with a same named methods of the `Trait.prototype`
  // that will have more relevant behavior.
  overrideBuildInMethods(object, Trait.prototype);

  // Trying to define given `properties` on the `object`. We use our custom
  // `defineProperties` function instead of build-in `Object.defineProperties`
  // that behaves exactly the same, except that it will throw if any
  // property in the given `properties` descriptor is marked as "required" or
  // "conflict" property.
  return defineProperties(object, properties);
}

/**
 * Composes new trait. If two or more traits have own properties with the
 * same name, the new trait will contain a "conflict" property for that name.
 * "compose" is a commutative and associative operation, and the order of its
 * arguments is not significant.
 *
 * **Please note:** That you should use `Trait.compose` instead of calling this
 * function with more then one argument, this functionality is kept strictly
 * for backwards compatibility.
 *
 * @params {Object} trait
 *    Takes traits as an arguments
 * @returns {Object}
 *    New trait containing the combined own properties of all the traits.
 * @example
 *    var newTrait = compose(trait_1, trait_2, ..., trait_N)
 */
function Trait(trait1, trait2) {

  // If function is called with one argument only we know that this arguments
  // is an object and it's properties must be mapped to a property descriptors
  // on a new instance of `Trait` so we delegate to `trait` function.
  // If function is called with more then one argument we know that those
  // arguments are instances of `Trait` or plain property descriptor maps
  // whose properties should be mixed into a new instance of `Trait` so we
  // delegate to `compose` function.
  return undefined === trait2 ? trait(trait1) : compose.apply(null, arguments)
}

Object.freeze(Object.defineProperties(Trait.prototype, {
  toString: {
    value: function toString() {
      return "[object " + this.constructor.name + "]";
    }
  },

  /**
   * `create` is like `Object.create`, except that it ensures that:
   *    - An exception is thrown if this trait defines a property that is
   *      marked as required property and same named property is not
   *      found in a given `prototype`.
   *    - An exception is thrown if this trait contains property that is
   *      marked as "conflict" property.
   * @param {Object}
   *    prototype of the compared object
   * @returns {Object}
   *    An object with all of the properties described by the trait.
   */
  create: {
    value: function createTrait(prototype) {
      return create(undefined === prototype ? Object.prototype : prototype,
                    this);
    },
    enumerable: true
  },

  /**
   * Composes new resolved trait, with all the same properties as the original
   * trait, except that all properties whose name is an own property of
   * resolutions will be renamed to `resolutions[name]`. If  `resolutions[name]`
   * is `null` value is swapped with a property marked as `equired` property.
   * @param {Object} resolutions
   *   An object whose own properties serve as a mapping from old names to new
   *   names, or to `null` if the property should be excluded.
   * @returns {Object}
   *   New trait with the same own properties as the original trait but renamed.
   */
  resolve: {
    value: function resolveTrait(resolutions) {
      return resolve(resolutions, this);
    },
    enumerable: true
  }
}));

/**
 * @see compose
 */
Trait.compose = Object.freeze(compose);
Object.freeze(compose.prototype);

/**
 * Constant singleton, representing placeholder for required properties.
 * @type {Object}
 */
Trait.required = Object.freeze(Object.create(Object.prototype, {
  toString: {
    value: Object.freeze(function toString() {
      return "<Trait.required>";
    })
  }
}));
Object.freeze(Trait.required.toString.prototype);

exports.Trait = Object.freeze(Trait);
