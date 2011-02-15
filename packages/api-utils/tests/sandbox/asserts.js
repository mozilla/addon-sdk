// We intentionally don't use strict mode in this module as we need to test
// behavior of ES5 methods in both strict & non-strict modes.

const AssertBase = require("test/assert").Assert;

// Saving build-in `Object` in case we will need to access it form the `create`
// exported function.
const _Object = Object;

/**
 * Creates `Assert` function that can be used as commonjs custom Assertor.
 * Optionally `Object` can be passed in order to provide assertion methods
 * bounded to the sandbox from where `Object` is originated.
 */
exports.create = function create(Object) {
  // Using `Object` from the current sandbox if `Object` was not provided.
  Object = Object || _Object;

  let DAssert = {
    /**
     * Asserts if given objects property descriptors are equivalent, contain
     * same attributes and have same getter / setter / value.
     */
    equalDescriptors: {
      value: function (expected, actual, message) {
        if (equalDescriptors(expected, actual)) {
          this.pass(message);
        } else {
          this.fail({
            expected: expectedDesc,
            actual: actualDesc,
            operator: "equalDescriptors",
            message: message
          });
        }
      }
    },
    /**
     * Tests if `object`'s `name` is ES5 non-writable property:
     *  1. Property descriptor has `writable` attribute with value `false`.
     *  2. [[Put]] throws a `TypeError` in strict mode.
     *  3. [[Put]] does not succeeds.
     */
    nonWritable: {
      value: function (object, name, message) {
        if (canPut(object, name)) {
          this.fail({
            operator: "nonWritable",
            message: message + " (`writable` attribute is not `false`)"
          });
        }
        else if (!isPutFails(object, name)) {
          this.fail({
            operator: "nonWritable",
            message: message + " (proprety value can be changed)"
          });
        }
        else if (!isPutThrowsInStrictMode(object, name)) {
          this.fail({
            operator: "nonWritable",
            message: message +
                     " (property change does not throws in strict mode)"
          });
        } else {
          this.pass(message);
        }
      },
      enumerable: true
    },
    /**
     * Tests if `object`'s `name` is ES5 non-configurable property:
     *  1. Property descriptor has `configurable` attribute with value `false`.
     *  2. [[Delete]] throws a `TypeError` in strict mode.
     *  3. [[Delete]] does not succeeds.
     *  4. Defining same named property throws `TypeError`.
     */
    nonConfigurable: {
      value: function nonConfigurable(object, name, message) {
        if (canDelete(object, name)) {
          this.fail({
            operator: "nonConfigurable",
            message: message + " (`configurable` attribute is not `false`)"
          });
        }
        else if (!isDeleteFails(object, name)) {
          this.fail({
            operator: "nonConfigurable",
            message: message + " (`delete` succeeded or returned `true`)"
          });
        }
        else if (!isDeleteThrowsInStrictMode(object, name, message)) {
          this.fail({
            operator: "nonConfigurable",
            message: message + " (`delete` does not throws in strict mode)"
          });
        }
        else if (!isDefineThrows(object, name)) {
          this.fail({
            operator: "nonConfigurable",
            message: message + " (redefining property did not throw)"
          });
        }
        else {
          this.pass(message);
        }
      },
      enumerable: true
    },
    /**
     * Tests if `object`'s `name` is ES5 non-enumerable property:
     *  1. Property descriptor has `enumerable` attribute with value `false`.
     *  2. Property is not enumerated.
     */
    nonEnumerable: {
      value: function nonEnumerable(object, name, message) {
        if (canEnumerate(object, name)) {
          this.fail({
            operator: "nonEnumerable",
            message: message + " (`enumerable` attribute is not `false`)"
          });
        }
        else if (isEnumerated(object, name)) {
          this.fail({
            operator: "nonEnumerable",
            message: message + " (property `" + name + "` was enumarated)"
          });
        }
        else {
          this.pass(message);
        }
      },
      enumerable: true
    }
  };

  function canPut(target, name) {
    "use strict";

    var descriptor = Object.getOwnPropertyDescriptor(target, name);
    return !descriptor ||
           ("value" in descriptor && descriptor.writable !== false);
  }
  
  function isPutFails(target, name) {
    var result = true;
    var value = target[name];

    target[name] = "<changed>" + value;

    if (target[name] !== value) {
      // reverting value back.
      target[name] = value;
      result = false;
    }
    
    return result;
  }

  function isPutThrowsInStrictMode(target, name) {
    "use strict";

    var value = target[name];
    var result = false;

    try {
      target[name] = "<changed>" + value;
      // Reverting value back in case exception was not thrown.
      target[name] = value;
    } catch (e) {
      result = true;
    }

    return result;
  }

  function canDelete(target, name) {
    "use strict";

    var descriptor = Object.getOwnPropertyDescriptor(target, name);
    return !descriptor || descriptor.configurable !== false;
  }

  function isDeleteFails(target, name) {
    var descriptor = Object.getOwnPropertyDescriptor(target, name);
    var result = false;
    
    // `delete` should return `false` for non-configurable properties and
    // property still must be defined.
    result = !(delete target[name]) &&
             !!Object.getOwnPropertyDescriptor(target, name);

    // Defining original property back.
    Object.defineProperty(target, name, descriptor)
    
    return result
  }

  function isDeleteThrowsInStrictMode(target, name) {
    "use strict";

    var descriptor = Object.getOwnPropertyDescriptor(target, name);
    var result = false;

    try {
      delete target[name];
      // Reverting value back in case exception was not thrown.
      Object.defineProperty(target, name, descriptor);
    } catch (e) {
      result = true;
    }

    return result;

  }

  function isDefineThrows(target, name) {
    "use strict";

    var descriptor = Object.getOwnPropertyDescriptor(target, name);
    var result = false;

    try {
      Object.defineProperty(target, name, { value: "<changed>" + target[name] });
      // Reverting property back in case if no exception was thrown.
      Object.defineProperty(target, name, descriptor);
    } catch (e) {
      result = true;
    }

    return result;
  }

  function canEnumerate(target, name) {
    "use strict";

    var descriptor = Object.getOwnPropertyDescriptor(target, name);
    return descriptor && descriptor.enumerable !== false;
  }

  function isEnumerated(target, name) {
    "use strict";

    return Object.keys(target).indexOf(name) >= 0;
  }

  function equalDescriptors(expected, actual) {
    return actual == expected ||
           (actual.get === expected.get &&
            actual.set === expected.set &&
            actual.value === expected.value &&
            (true !== actual.enumerable) === (true !== expected.enumerable) &&
            (true !== actual.configurable) === (true !== expected.configurable) &&
            (true !== actual.writable) === (true !== expected.writable));
  }

  return function Assert() {
    return Object.create(AssertBase.apply(null, arguments), DAssert);
  };
};
