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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

/**
 * The `AssertionError` is defined in assert.
 * @extends Error
 * @example
 *  new assert.AssertionError({
 *    message: message,
 *    actual: actual,
 *    expected: expected
 *  })
 */
function AssertionError(options) {
  let assertionError = Object.create(AssertionError.prototype);
  if ("string" === typeof options)
    options = { message: options };
  if ('actual' in options)
    assertionError.actual = options.actual;
  if ('expected' in options)
    assertionError.expected = options.expected;
  if ('operator' in options)
    assertionError.operator = options.operator;
  assertionError.message = options.message;
  assertionError.stack = new Error().stack;
}
AssertionError.prototype = Object.create(Error.prototype, {
  constructor: { value: AssertionError },
  name: { value: 'AssertionError', enumerable: true },
  toString: { value: function toString() {
    let value;
    if (this.message) {
      value = this.name + " : " + this.message;
    }
    else {
      value = [
        this.name + " : ",
        represent(this.expected),
        this.operator,
        represent(this.actual)
      ].join(" ");
    }
    return value;
  }}
});
exports.AssertionError = AssertionError;

function Assert(logger) {
  return Object.create(Assert.prototype, { _log: { value: logger }});
}
Assert.prototype = {
  fail: function fail(e) {
    this._log.fail(e.message);
  },
  pass: function pass(message) {
    this._log.pass(message);
  },
  error: function error(e) {
    this._log.exception(e);
  },
  ok: function ok(value, message) {
    if (!!!value) {
      this.fail({
        actual: value,
        expected: true,
        message: message,
        operator: '=='
      });
    }
    else {
      this.pass(message);
    }
  },
  /**
   * The equality assertion tests shallow, coercive equality with `=`.
   * @example
   *    assert.equal(actual, expected, message_opt)
   */
  equal: function equal(actual, expected, message) {
    if (actual != expected) {
      this.fail({
        actual: actual,
        expected: expected,
        message: message,
        operator: '=='
      });
    }
    else {
      this.pass(message);
    }
  },
  /**
   * The non-equality assertion tests for whether two objects are not equal
   * with `!=`.
   * @example
   *    assert.notEqual(actual, expected, message_opt)
   */
  notEqual: function notEqual(actual, expected, message) {
    if (actual == expected) {
      this.fail({
        actual: actual,
        expected: expected,
        message: message,
        operator: '!=',
      });
    } else {
      this.pass(message);
    }
  },
  /**
   * The equivalence assertion tests a deep equality relation.
   * @example
   *    assert.deepEqual(actual, expected, message_opt)
   */
   deepEqual: function deepEqual(actual, expected, message) {
    if (!_deepEqual(actual, expected)) {
      this.fail({
        actual: actual,
        expected: expected,
        message: message,
        operator: 'deepEqual'
      });
    }
    else {
      this.pass(message);
    }
  },
  /**
   * The non-equivalence assertion tests for any deep inequality.
   * @example
   *    assert.notDeepEqual(actual, expected, message_opt)
   */
  notDeepEqual: function notDeepEqual(actual, expected, message) {
    if (_deepEqual(actual, expected)) {
      this.fail({
        actual: actual,
        expected: expected,
        message: message,
        operator: "notDeepEqual"
      });
    }
    else {
      pass(message);
    }
  },
  /**
   * The strict equality assertion tests strict equality, as determined by
   * `===`.
   * @example
   *    assert.strictEqual(actual, expected, message_opt)
   */
  strictEqual: function strictEqual(actual, expected, message) {
    if (actual !== expected) {
      this.fail({
        actual: actual,
        expected: expected,
        message: message,
        operator: '==='
      });
    } else {
      this.pass(message);
    }
  },
  // 10. The strict non-equality assertion tests for strict inequality, as
  // determined by !==.assert.notStrictEqual(actual, expected, message_opt);
  notStrictEqual: function notStrictEqual(actual, expected, message) {
    if (actual === expected) {
      this.fail({
        actual: actual,
        expected: expected,
        message: message,
        operator: '!=='
      })
    }
    else {
      this.pass(message);
    }
  }
  // 11. Expected to throw an error:
  // assert.throws(block, Error_opt, message_opt);
, throws: function raises(block, Error, message) {
    let threw = false;
    let exception = null;
    if ("string" == typeof Error && undefined == message) {
      message = Error;
      Error = undefined;
    }
    try {
      block();
    } catch (e) {
      threw = true;
      exception = e;
    }
    if (threw &&
        (!Error || ("string" == typeof Error &&
                    0 <= exception.message.indexOf(Error)) ||
         ('function' == typeof Error && 'RegExp' == Error.constructor.name
          && Error.test(exception.message)) ||
         ('function' == typeof exception && exception instanceof Error))) {
      this.pass(message);
    }
    else {
      let failure = {
        message: message,
        operator: "throws"
      }

      if (exception)
        failure = e.actual = exception
      if (Error)
        failure = e.expected = Error

      this.fail(failure);
    }
  }
};
exports.Assert = Assert;

/**
 * Internal utility function that is used to generate
 * textual representation of things passed to it.
 */
function represent(thing) {
  let result;
  switch(typeof(thing)) {
    case "string":
      result = '"' + thing + '"';
      break;
    case "number":
      result = thing;
      break;
    case "object":
      if (null === thing) {
        result = 'null';
        break;
      }
      let names = []
      for (let name in thing)
        names.push(name);
      result = thing;
      if (names.length > 0) {
        result += " - {";
        result += names.slice(0, 7).map(function(n) {
          let repr = n + ": ";
          try {
            repr += 'object' == typeof thing[n] ? "{...}" : represent(thing[n]);
          } catch(e) {
            repr += "[Exception!]";
          }
          return repr;
        }).join(", ");
        if (names.length > 7)
          result += ", ...";
        result += "}";
      }
      break;
    case "function":
      result = thing.toString().split('\n').slice(0, 2).join('\n') + '\n...}'
      break;
    default:
      result = '' + thing;
   }
   return result;
}


function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  }
  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  else if ((actual instanceof Date && expected instanceof Date) ||
           (typeof actual == typeof expected && typeof actual == 'object' &&
            actual.constructor && expected.constructor &&
            'Date' == actual.constructor.name &&
            'Date' == expected.constructor.name)) {
    return actual.getTime() === expected.getTime();
  }
  // 7.3. Other pairs that do not both pass typeof value == "object",
  // equivalence is determined by ==.
  else if ('object' != typeof actual && 'object' != typeof expected) {
    return actual == expected;
  }
  // XXX specification bug: this should be specified
  else if ('string' == typeof expected || 'string' == typeof actual) {
    return expected === actual;
  }
  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical "prototype" property. Note: this
  // accounts for both named and indexed properties on Arrays.
  else {
    return actual.prototype === expected.prototype && _equiv(actual, expected);
  }
}

function _equiv(a, b, stack) {
  return (a !== null && a !== undefined && b !== null && b !== undefined &&
          _equivArray(Object.keys(a).sort(), Object.keys(b).sort()) &&
          Object.keys(a).every(function(key) {
            return _deepEqual(a[key], b[key], stack);
          }));
}

function _arrayLike(thing) {
  return ((Array.isArray && Array.isArray(thing)) ||
          ('[object Array]' == Object.prototype.toString.call(thing)) ||
          ('[object Arguments]' == Object.prototype.toString.call(thing)));
}

function _equivArray(a, b, stack) {
  return (_arrayLike(a) && _arrayLike(b) &&
          Array.prototype.every.call(a, function(value, index) {
            return _deepEqual(value, b[index])
          }));
}
