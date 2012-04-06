/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

var getPrototypeOf = Object.getPrototypeOf;
var getNames = Object.getOwnPropertyNames;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var create = Object.create;
var freeze = Object.freeze;
var unbind = Function.call.bind(Function.bind, Function.call);

// This shortcut makes sure that we do perform desired operations, even if
// associated methods have being overridden on the used object.
var owns = unbind(Object.prototype.hasOwnProperty);
var apply = unbind(Function.prototype.apply);
var slice = Array.slice || unbind(Array.prototype.slice);
var reduce = Array.reduce || unbind(Array.prototype.reduce);
var map = Array.may || unbind(Array.prototype.map);
var concat = Array.concat || unbind(Array.prototype.concat);

function isFunciton(value) { return typeof(value) === 'function'; }

// Utility function to get own properties descriptor map.
function getOwnPropertiesDescriptor(object) {
  return reduce(getNames(object), function(descriptor, name) {
    descriptor[name] = getOwnPropertyDescriptor(object, name);
    return descriptor;
  }, {});
}

/**
 * Takes `source` object as an argument and returns identical object
 * with the difference that all own properties will be non-enumerable
 */
function obscure(source) {
  var descriptor = reduce(getNames(source), function(descriptor, name) {
    var property = getOwnPropertyDescriptor(source, name);
    property.enumerable = false;
    descriptor[name] = property;
    return descriptor;
  }, {});
  return create(getPrototypeOf(source), descriptor);
}
exports.obscure = obscure;

/**
 * Takes arbitrary number of source objects a fresh object that inherits from
 * the same prototype as a first argument and implements all own properties of
 * all argument objects. If two or more argument objects have own properties
 * with the same name, the property is overridden, with precedence from right
 * to left, implying, that properties of the object on the left are overridden
 * by a same named property of the object on the right.
 */
var mix = function(source) {
  var descriptor = reduce(slice(arguments), function(descriptor, source) {
    return reduce(getNames(source), function(descriptor, name) {
      descriptor[name] = getOwnPropertyDescriptor(source, name);
      return descriptor;
    }, descriptor);
  }, {});

  return create(getPrototypeOf(source), descriptor);
};
exports.mix = mix;

/**
 * Returns a frozen object with that inherits from the given `prototype` and
 * implements all own properties of the given `properties` object.
 */
function extend(prototype, properties) {
  return freeze(create(prototype, getOwnPropertiesDescriptor(properties)));
}
exports.extend = extend;

var Class = new function() {
  function prototypeOf(input) {
    return isFunciton(input) ? input.prototype : input;
  }
  var none = freeze([]);

  return function Class(options) {
    var ancestor = owns(options, 'extends') ? prototypeOf(options.extends) :
                    Class.prototype;
    var sources = !owns(options, 'implements') ? none :
                    freeze(map(options.implements, prototypeOf));

    // Create prototype that inherits from given ancestor passed as
    // `options.extends`, falling back to `Type.prototype`, implementing all
    // properties of given `options.implements` and `options` itself.
    var prototype = extend(ancestor, apply(mix, mix, concat(sources, options, {
      extends: ancestor,
      implements: sources
    })));

    function constructor() {
      return apply(prototype.constructor, create(prototype), arguments);
    }
    constructor.prototype = prototype;
    return freeze(constructor);
  };
}
Class.prototype = extend(null, obscure({
  constructor: function constructor() {
    this.initialize.apply(this, arguments);
    return this;
  },
  initialize: function initialize() {
    // Do your initialization logic here
  },
  // Copy useful properties from `Object.prototype`.
  toString: Object.prototype.toString,
  toLocaleString: Object.prototype.toLocaleString,
  toSource: Object.prototype.toSource,
  valueOf: Object.prototype.valueOf,
  isPrototypeOf: Object.prototype.isPrototypeOf
}));
exports.Class = freeze(Class);
