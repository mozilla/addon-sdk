// We intentionally don't use strict mode in this module as we need to test
// behavior of ES5 methods in both strict & non-strict modes.

const BaseAssert = require("test/assert").Assert;

// Save built-in `Object` in case we need to access it from the `create`
// exported function.
const _Object = Object;

function isPropertyEnumerable(descriptor) {
  return descriptor.enumerable;
}

function isPropertyConfigurable(descriptor) {
  return descriptor.configurable;
}

function isPropertyWritable(descriptor) {
  return descriptor.writable;
}

function isDescriptorsEqual(expected, actual) {
  return actual == expected ||
         (actual.get === expected.get &&
          actual.set === expected.set &&
          actual.value === expected.value &&
          isPropertyEnumerable(actual) === isPropertyEnumerable(expected) &&
          isPropertyConfigurable(actual) === isPropertyConfigurable(expected) &&
          isPropertyWritable(actual) === isPropertyWritable(expected));
}

// Utility function returns composed function that return inverted value of
// the given `source` function when called with same arguments.
function invert(source) function inverted() !source.apply(this, arguments);

// Utility function that composes CommonJS custom assertion function out of
// the given `assertor` function. Composed function fails if `assertor` returns
// `false` and passes otherwise.
function assertion(assertor) {
  return function assert() {

    let args = Array.slice(arguments);
    let message = args.pop();

    if (assertor.apply(this, args))
      this.pass(message);
    else
      this.fail({ message: message, operator: assertor.name });
  };
}

/**
 * Creates `Assert` function that can be used as CommonJS custom Assertor.
 * Optionally `Object` can be passed in order to provide assertion methods
 * bound to the sandbox from where `Object` originates.
 */
exports.create = function create(Object) {
  // Use `Object` from the current sandbox if `Object` was not provided.
  Object = Object || _Object;

  // Similar to `Object.getOwnPropertyDescriptor` with a difference that this
  // also returns descriptors for inherited properties.
  function getPropertyDescriptor(object, name) {
    let prototype, descriptor = Object.getOwnPropertyDescriptor(object, name);
    if (!descriptor && (prototype = Object.getPrototypeOf(object)))
      descriptor = getPropertyDescriptor(prototype, name);
    return descriptor;
  }

  function isKindOf(isPropertyKindOf) {
    "use strict";

    return function isKindOf(target, name) {
      let descriptor = getPropertyDescriptor(target, name);
      return !descriptor || isPropertyKindOf(descriptor);
    }
  }

  let isWritable = isKindOf(isPropertyWritable);
  let isConfigurable = isKindOf(isPropertyConfigurable);
  let isEnumerable = isKindOf(isPropertyEnumerable);

  function doesWriteFails(target, name) {
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

  function doesWriteThrows(target, name) {
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

  function doesDeleteFails(target, name) {
    let descriptor = Object.getOwnPropertyDescriptor(target, name);

    // `delete` should return `false` for non-configurable properties and
    // property still must be defined.
    let isDeleted = !(delete target[name]) &&
                    !!Object.getOwnPropertyDescriptor(target, name);

    // Revert to original property if delete succeeded.
    if (!isDeleted && descriptor)
      Object.defineProperty(target, name, descriptor);

    return isDeleted;
  }

  function doesDeleteThrows(target, name) {
    "use strict";

    let descriptor = Object.getOwnPropertyDescriptor(target, name);
    let result = false;

    try {
      // Revert value back if exception was not thrown and delete succeeded.
      if (delete target[name])
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
    let value = target[name] + "<override>";
    let result = false;

    try {
      Object.defineProperty(target, name, { value: value, configurable: true });
      // Revert property back if define succeeded
      if (target[name] === value) {
        if (descriptor)
          Object.defineProperty(target, name, descriptor);
        else 
          delete target[name];
      }
    }
    catch (e) {
      result = true;
    }

    return result;
  }

  function isEnumerated(target, name) {
    "use strict";

    for (let key in target) {
      if (key === name) return true;
    }
    return false;
  }


  function equalDescriptors(expected, actual, message) {
    if (isDescriptorsEqual(expected, actual)) {
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
  }

  return function Assert() {
    let assert = Object.create(BaseAssert.apply(null, arguments));

    assert.equalDescriptors = equalDescriptors;
    assert.writable = assertion(isWritable);
    assert.nonWritable = assertion(invert(isWritable));
    assert.writeFails = assertion(doesWriteFails);
    assert.writeSucceeds = assertion(invert(doesWriteFails));
    assert.writeThrowsInStrict = assertion(doesWriteThrows);
    assert.writeDoesNotThrowsInStrict = assertion(invert(doesWriteThrows));
    assert.configurable = assertion(isConfigurable);
    assert.nonConfigurable = assertion(invert(isConfigurable));
    assert.deleteFails = assertion(doesDeleteFails);
    assert.deleteSucceeds = assertion(invert(doesDeleteFails));
    assert.deleteThrowsInStrict = assertion(doesDeleteThrows);
    assert.deleteDoesNotThrowsInStrict = assertion(invert(doesDeleteThrows));
    assert.defineThrows = assertion(doesDefineThrows);
    assert.defineDoesNotThrows = assertion(invert(doesDefineThrows));
    assert.enumerable = assertion(isEnumerable);
    assert.nonEnumerable = assertion(invert(isEnumerable));
    assert.isEnumerated = assertion(isEnumerable);
    assert.isNotEnumerated = assertion(invert(isEnumerated));

    return assert;
  };
};
