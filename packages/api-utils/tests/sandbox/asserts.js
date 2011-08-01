// We intentionally don't use strict mode in this module as we need to test
// behavior of ES5 methods in both strict & non-strict modes.

const BaseAssert = require("test/assert").Assert;

// Save built-in `Object` in case we need to access it from the `create`
// exported function.
const _Object = Object;

function isEnumerable(descriptor) {
  return descriptor.enumerable || descriptor.enumerable === undefined;
}
function isConfigurable(descriptor) {
  return descriptor.configurable || descriptor.configurable === undefined;
}
function isWritable(descriptor) {
  return descriptor.writable || descriptor.writable === undefined;
}

/**
 * Creates `Assert` function that can be used as CommonJS custom Assertor.
 * Optionally `Object` can be passed in order to provide assertion methods
 * bound to the sandbox from where `Object` originates.
 */
exports.create = function create(Object) {
  // Use `Object` from the current sandbox if `Object` was not provided.
  Object = Object || _Object;

  function canPut(target, name) {
    "use strict";

    let descriptor = Object.getOwnPropertyDescriptor(target, name);
    return !descriptor || isWritable(descriptor);
  }

  function doesPutFails(target, name) {
    let result = true;
    let value = target[name];

    target[name] = "<changed>" + value;

    if (target[name] !== value) {
      // revert value back.
      target[name] = value;
      result = false;
    }

    return result;
  }

  function doesPutThrowsInStrictMode(target, name) {
    "use strict";

    let value = target[name];
    let result = false;

    try {
      target[name] = "<changed>" + value;
      // Revert value back if exception was not thrown.
      target[name] = value;
    }
    catch (e) {
      result = true;
    }

    return result;
  }

  function canDelete(target, name) {
    "use strict";

    let descriptor = Object.getOwnPropertyDescriptor(target, name);
    return !descriptor || isConfigurable(descriptor);
  }

  function doesDeleteFails(target, name) {
    let descriptor = Object.getOwnPropertyDescriptor(target, name);
    let result = false;

    // `delete` should return `false` for non-configurable properties and
    // property still must be defined.
    result = !(delete target[name]) &&
             !!Object.getOwnPropertyDescriptor(target, name);

    // Define original property back.
    Object.defineProperty(target, name, descriptor);

    return result;
  }

  function doesDeleteThrowsInStrictMode(target, name) {
    "use strict";

    let descriptor = Object.getOwnPropertyDescriptor(target, name);
    let result = false;

    try {
      delete target[name];
      // Revert value back in case exception was not thrown.
      Object.defineProperty(target, name, descriptor);
    }
    catch (e) {
      result = true;
    }

    return result;

  }

  function doesDefineThrows(target, name) {
    "use strict";

    let descriptor = Object.getOwnPropertyDescriptor(target, name);
    let result = false;

    try {
      Object.defineProperty(target, name, {
        value: "<changed>" + target[name]
      });
      // Revert property back if exception was not thrown.
      Object.defineProperty(target, name, descriptor);
    }
    catch (e) {
      result = true;
    }

    return result;
  }

  function canEnumerate(target, name) {
    "use strict";

    let descriptor = Object.getOwnPropertyDescriptor(target, name);
    return !descriptor || isEnumerable(descriptor);
  }

  function isEnumerated(target, name) {
    "use strict";

    return ~Object.keys(target).indexOf(name);
  }

  function equalDescriptors(expected, actual) {
    return actual == expected ||
           (actual.get === expected.get &&
            actual.set === expected.set &&
            actual.value === expected.value &&
            isEnumerable(actual) === isEnumerable(expected) &&
            isConfigurable(actual) === isConfigurable(expected) &&
            isWritable(actual) === isWritable(expected));
  }

  const assertDescriptor = {

    /**
     * Asserts if given object's property descriptors are equivalent, contain
     * same attributes and have same getter / setter / value.
     */
    equalDescriptors: {
      value: function (expected, actual, message) {
        if (equalDescriptors(expected, actual)) {
          this.pass(message);
        }
        else {
          this.fail({
            expected: expected,
            actual: actual,
            operator: "equalDescriptors",
            message: message
          });
        }
      },
      enumerable: true
    },

    /**
     * Tests if `object`'s `name` is ES5 non-writable property:
     *  1. Property descriptor has `writable` attribute with value `false`.
     *  2. [[Put]] throws a `TypeError` in strict mode.
     *  3. [[Put]] does not succeed.
     */
    nonWritable: {
      value: function (object, name, message) {
        if (canPut(object, name)) {
          this.fail({
            operator: "nonWritable",
            message: message + " (`writable` attribute is not `false`)"
          });
        }
        else if (!doesPutFails(object, name)) {
          this.fail({
            operator: "nonWritable",
            message: message + " (property value can be changed)"
          });
        }
        else if (!doesPutThrowsInStrictMode(object, name)) {
          this.fail({
            operator: "nonWritable",
            message: message +
                     " (property change does not throw in strict mode)"
          });
        }
        else {
          this.pass(message);
        }
      },
      enumerable: true
    },

    /**
     * Tests if `object`'s `name` is ES5 non-configurable property:
     *  1. Property descriptor has `configurable` attribute with value `false`.
     *  2. [[Delete]] throws a `TypeError` in strict mode.
     *  3. [[Delete]] does not succeed.
     *  4. Defining same-named property throws `TypeError`.
     */
    nonConfigurable: {
      value: function nonConfigurable(object, name, message) {
        if (canDelete(object, name)) {
          this.fail({
            operator: "nonConfigurable",
            message: message + " (`configurable` attribute is not `false`)"
          });
        }
        else if (!doesDeleteFails(object, name)) {
          this.fail({
            operator: "nonConfigurable",
            message: message + " (`delete` succeeded or returned `true`)"
          });
        }
        else if (!doesDeleteThrowsInStrictMode(object, name, message)) {
          this.fail({
            operator: "nonConfigurable",
            message: message + " (`delete` does not throw in strict mode)"
          });
        }
        else if (!doesDefineThrows(object, name)) {
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
            message: message + " (property `" + name + "` was enumerated)"
          });
        }
        else {
          this.pass(message);
        }
      },
      enumerable: true
    }
  };

  return function Assert() {
    return Object.create(BaseAssert.apply(null, arguments), assertDescriptor);
  };
};
