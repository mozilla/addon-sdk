/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: false */
/*global define: true */

!(typeof define !== "function" ? function($){ $(require, exports, module); } : define)(function(require, exports, module, undefined) {

var compose = require('../functional').compose
var slice = Array.prototype.slice
var stringify = Object.prototype.toString
var isArray = Array.isArray || function isArray(value) {
  return stringify.call(value) === '[object Array]'
}
function isSchema(value) {
  return value && typeof value === 'object' && !isArray(value)
}
function reference(value) { return value }

exports.version = "0.2.0"

/**
 * # Guard #
 *
 * Function takes `isValid` function `defaults` function or value and `message`
 * as an argument and returns guard function that may be used to guard values.
 * Each value passed to the guard will be validated using given `isValid` if it
 * returns `true` value is passed through, otherwise `TypeError` is thrown with
 * a given message. If guard is called without an argument, `defaults` is used.
 * If defaults is a function it's value is used otherwise `defaults` is used
 * itself.
 * @param {Function} isValid
 *    Function that will be used by guard to validate values. It will be called
 *    with `value` argument that needs to be validated. If function returns
 *    `true` value is valid if `false` it's not.
 * @param {Function|*} defaults
 *    Function that returns default value or a default value itself to be used
 *    when guard is called without arguments.
 * @param {String} [message="Unexpected value: `{{value}}`"]
 *    Optional `message` argument may be passed that will be used as a template
 *    for a `TypeError` message that is thrown by generated guards when called
 *    with invalid values.
 */

/**
 * # Guard #
 *
 * Guard function that may be called with a `value` to be set to a guarded
 * variable. If `value` is invalid `TypeError` is thrown. Optionally second
 * `name` argument may be passed, which is useful when guards are used for
 * object properties. In such case `name` argument just name of object
 * property and will be used to give a better error messages.
 * @param {Object|String|Number|function} value
 *    Value to be validated.
 * @param {String} name
 *    Name of the property that is being guarded.
 */
function Guard(isValid, defaults, message) {
  message = message || "Unexpected value: `{{value}}`"
  return function guard(value, name) {
    value = value !== undefined ? value :
            typeof defaults === 'function' ? defaults() : defaults
    if (!isValid(value))
       throw new TypeError(message.replace("{{name}}", name).
                                   replace("{{value}}", value).
                                   replace("{{type}}", typeof value));
    return value
  }
}
exports.Guard = Guard

/**
 * # Schema #
 *
 * Schema is useful for defining guards for data objects that have particular
 * structure. Function takes `descriptor` argument that is a map of guards
 * guarding same named properties of the value being validated. Scheme may
 * contain guards for a primitive values like `String` and `Number` and also
 * guards for more complex data structures defined by other `Schema`s, or to
 * put it other way `Schema` may contain guards that were created by `Schema`
 * itself which allows defining deeply nested data structures.
 *
 * Generated guard will accept only object `values` as an argument. All the
 * non-guarded properties (that are not present in the `descriptor`) of the
 * `value` will be stripped out. All the missing properties of the `value`
 * will be replaced / assembled from the defaults if associated guards provide
 * fallback mechanism to default value.
 *
 * @param {Object} descriptor
 *    Object containing guards for the associated (same named properties) of
 *    the guarded object `value`.
 * @param {String} [message]
 *    Optional error message template that will be a message of a `TypeError`
 *    that is will be thrown if returned guard is invoked with a wrong `value`
 *    type (other then "object" or "undefined"). If `message` contains
 *    `"{{value}}"` and `"{{type}}"` strings they are going to be replaced with
 *    an actual `value` and it's type.
 *
 * ## Examples ##
 *
 *      var guards = require("guards");
 *      var Point = guards.Schema({
 *        x: guards.Number(0),
 *        y: guards.Number(0)
 *      });
 *
 *      new Point
 *      // { x: 0, y: 0 }
 *
 *      Point({ x: 17, z: 50 })
 *      // { x: 17, y: 0 }
 *
 *      Point({ x: "5" })
 *      // TypeError: Number expected instead of string `5`
 *
 *      Point("{ y: 6 }")
 *      // TypeError: Object expected instead of string `{ y: 6 }`
 *
 *
 *      var Segment = guards.Schema({
 *        start: Point,
 *        end: Point,
 *        opacity: guards.Number(1)
 *      })
 *
 *      new Segment
 *      // { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 }
 *
 *      Segment({ end: { x: 17 }, opacity: 0.5 })
 *      // { start: { x: 0, y: 0 }, end: { x: 17, y: 0 }, opacity: 0.5 }
 *
 *      Segment({ start: 17 });
 *      // TypeError: Object expected instead of number `17`
 *
 */
exports.Schema = function Schema(schema, message) {
  message = message || 'Object expected instead of {{type}} `{{value}}`'
  return compose(function guard(value) {
    var validated = {}
    for (var key in schema) validated[key] = schema[key](value[key], key)
    return validated
  }, Guard(isSchema, Object, message))
}

/**
 * # Array #
 *
 * Array can be used to define guards for an arrays containing elements of some
 * type or schema. Function takes `guard` as an argument that will guard all the
 * elements of the `value` array that is passed to the returned guard.
 *
 * @param {Function} guard
 *    Guard that is going to be used to verify elements of the array. It can
 *    be any guard created by `String`, `Schema`, `Array` or any custom guard
 *    as well.
 * @param {String} [message]
 *    Optional error message template that will be a message of a `TypeError`
 *    that is will be thrown if returned guard is invoked with a wrong `value`
 *    type (other then "array" or "undefined"). If `message` contains
 *    `"{{value}}"` and `"{{type}}"` strings they are going to be replaced with
 *    an actual `value` and it's type.
 *
 * ## Examples ##
 *
 *      var guards = require("guards")
 *      var Words = guards.Array(guards.String(''))
 *
 *      Words([ "foo", "bar" ])
 *      // [ 'foo', 'bar' ]
 *
 *      Words([ "foo", 9 ])
 *      // TypeError: String expected instead of number `9`
 *
 *      var Point = guards.Schema({
 *        x: guards.Number(0),
 *        y: guards.Number(0)
 *      })
 *      var Points = guards.Array(Point)
 *
 *      new Points([{}, { x: 2, y: 8 }])
 *      // [ { x: 0, y: 0 }, { x: 2, y: 8 } ]
 *
 *      Points({ x: 2, y: 8 })
 *      // TypeError: Array expected instead of object `[object Object]`
 *
 *
 *      var Graph = guards.Array(Points)
 *
 *      new Graph
 *      // []
 *
 *      Graph([
 *        [{ x: 17, foo: "bar" }, { x: 16 }],
 *        [{ y: 4 }],
 *        []
 *      ])
 *      // [ [ { x: 17, y: 0 }, { x: 16, y: 0 } ], [ { x: 0, y: 4 } ], [] ]
 */
exports.Array = function Array(type, message) {
  var Type = [].constructor
  message = message || 'Array expected instead of {{type}} `{{value}}`'
  type = type || reference
  return compose(function guard(value) {
    return value.map(type)
  }, Guard(isArray, Type, message))
}


/**
 * # Tuple #
 *
 * Tuple can be used to define guards for an arrays containing predefined
 * amount of elements guarded by specific guards. Tuple guards are something
 * in between Array and Schema guards. Function takes array of guards as an
 * argument that will be used to validate same indexed elements of the `value`
 * array that is passed to the returned guard.
 *
 * @param {Function[]} guards
 *    Guards that are going to be used to verify elements of the array. It can
 *    be any guard created by `String`, `Schema`, `Array` or any custom guard
 *    as well.
 * @param {String} [message]
 *    Optional error message template that will be a message of a `TypeError`
 *    that is will be thrown if returned guard is invoked with a wrong `value`
 *    type (other then "array" or "undefined"). If `message` contains
 *    `"{{value}}"` and `"{{type}}"` strings they are going to be replaced with
 *    an actual `value` and it's type.
 *
 * ## Examples ##
 *
 *      var guards = require("guards");
 *      var Point = guards.Schema({
 *        x: guards.Number(0),
 *        y: guards.Number(0)
 *      });
 *      var Segment = guards.Schema({
 *        start: Point,
 *        end: Point,
 *        opacity: guards.Number(1)
 *      });
 *      var Triangle = guards.Tuple([ Segment, Segment, Segment ]);
 *
 *      var t1 = Triangle();
 *      // [ { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 },
 *      //   { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 },
 *      //   { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 }
 *      // ]
 *
 *      var t2 = Triangle([
 *        { opacity: 0, foo: "bar" },
 *        { start: { x: 2 } }
 *      ]);
 *      // [ { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 0 },
 *      //   { start: { x: 2, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 },
 *      //   { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 }
 *      // ]
 *
 *      var t2 = Triangle("foo");
 *      // TypeError: Array expected instead of string `foo`
 *
 *      var t3 = Triangle([{ start: { x: '3' } } ]);
 *      // TypeError: Number expected instead of string `3`
 *
 *      var Pointer = guards.Tuple([ Point, Segment ]);
 *
 *      var p1 = Pointer();
 *      // [ { x: 0, y: 0 }, { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 } ]
 *
 *      var p2 = Pointer([ { x: 17 }, { opacity: 0 } ]);
 *      // [ { x: 17, y: 0 }, { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 0 } ]
 *
 *      var p3 = Pointer([ { foo: "bar" }, { baz: "bla" }, "foo" ]);
 *      // [ { x: 0, y: 0 }, { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 1 } ]
 */
exports.Tuple = function Tuple(schema, message) {
  message = message || 'Array expected instead of {{type}} `{{value}}`'
  return compose(function guard(value) {
    return schema.map(function(guard, index) {
      return guard(value[index], index)
    })
  }, Guard(isArray, Array, message))
}

/**
 * # AnyOf #
 *
 * `AnyOf` can be used to define guards that validates `value`s that must
 * satisfy just one of many guards. This is handy in specific specific
 * scenarios were valid `value` may have different types or schemas.
 * Function takes any number guards as an arguments and returns composed
 * guard, which when called will try to validate a given `value` with a given
 * guards in an order they were passed, the first validate `value` is returned
 * as result, unless non will validate in which case `TypeError` is thrown.
 *
 * @params {Function} guard
 *    Guards used for validations.
 * @returns {Function}
 *
 * ## Examples ##
 *
 *      var guards = require("guards")
 *      var ObjectPoint = guards.Schema({
 *        x: guards.Number(0),
 *        y: guards.Number(0)
 *      })
 *      var ArrayPoint = guards.Tuple.extend([
 *        guards.Number(0),
 *        guards.Number(0)
 *      ])
 *      var Point = guards.AnyOf([ ObjectPoint, ArrayPoint ])
 *
 *      Point([ 1 ])
 *      // [ 1, 0 ]
 *
 *      Point({ y: 15 })
 *      // { x: 0, y: 15 }
 *
 *      Point(1, 2)
 *      // TypeError: Passed value: `1` has invalid type or structure
 */
exports.AnyOf = function AnyOf(guards, message) {
  message = message || 'Passed value: `{{value}}` has invalid type or structure'
  return function guard(value, name) {
    var i = 0, ii = guards.length
    while(i < ii) {
      try { return guards[i++](value, name) } catch (error) { /* swallow */ }
    }
    throw new TypeError(message.replace("{{name}}", name).
                                replace("{{value}}", value).
                                replace("{{type}}", typeof value))
  }
}

});
