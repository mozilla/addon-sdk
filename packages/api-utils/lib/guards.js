/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true
         forin: false */
/*global define: true */

!(typeof define !== "function" ? function($){ $(require, exports, module); } : define)(function(require, exports, module, undefined) {

var core = require('./guards/core.js')

function isFunction(value) {
    return typeof value === "function" && value.call && value.apply;
}
function isUndefined(value) {
  return value === undefined
}
function isNull(value) {
  return value === null;
}
function isNumber(value) {
  return typeof value === "number";
}
function isString(value) {
  return typeof value === "string";
}
function isObject(value) {
    return typeof value === "object" && value !== null;
}
function isBoolean(value) {
  return value === true || value === false;
}


exports.version = "0.2.0"
var Guard = exports.Guard = core.Guard
exports.Schema = core.Schema
exports.Array = core.Array
exports.Tuple = core.Tuple
exports.AnyOf = core.AnyOf


/*
 * # Function #
 *
 * Function creates a function guard - function that may be used to perform run
 * time type checks on the values. Function takes an optional `defaultValue`
 * that will be returned by a created guard if it's invoked without (or with
 * `undefined`) `value` argument. The `defaultValue` will fall back to
 * `undefined` if not provided. Function also takes another optional argument
 * `message` that represents a template of a message of the `TypeError` that
 * will be thrown by guard if it's invoked with invalid `value`.
 *
 * @param {Object|String|Number|function} [defaultValue]
 *    Value that returned guard is going to fall back to if invoked without
 *    a `value` or if it's `undefined`.
 * @param {String} [message]
 *    Optional error message template that will be a message of a `TypeError`
 *    that is will be thrown if returned guard is invoked with a wrong `value`
 *    type. If `message` contains `"{{value}}"` and `"{{type}}"` strings they
 *    are going to be replaced with an actual `value` and it's type.
 *
 * ## Examples ##
 *
 *
 *      var guards = require("guards");
 *
 *      var Callee = guards.Function();
 *
 *      Callee(Object) == Object
 *      // true
 *
 *      Callee(function() { return "hello world" })
 *      Callee(function() { return "hello world" })
 *
 *      Callee(7);
 *      // TypeError: Function expected instead of number `7`
 *
 *      guards.Function("Hi", "{{type}} is not a function.");
 *
 *      Callee({})
 *      // TypeError: object is not a function
 */
exports.Function = function Function(defaultValue, message) {
  message = message || 'Function expected instead of {{type}} `{{value}}`'
  return Guard(isFunction, defaultValue, message)
}

/**
 * # String #
 *
 * Function creates a string guard - function that may be used to perform run
 * time type checks on the values. Function takes an optional `defaultValue`
 * that will be returned by a created guard if it's invoked without (or with
 * `undefined`) `value` argument. The `defaultValue` will fallback to
 * `undefined` if not provided. Function also takes another optional argument
 * `message` that represents a template of a message of the `TypeError` that
 * will be thrown by guard if it's invoked with incorrect value.
 *
 * @param {Object|String|Number|function} [defaultValue]
 *    Value that returned guard is going to fall back to if invoked without
 *    a `value` or if it's `undefined`.
 * @param {String} [message]
 *    Optional error message template that will be a message of a `TypeError`
 *    that is will be thrown if returned guard is invoked with a wrong `value`
 *    type. If `message` contains `"{{value}}"` and `"{{type}}"` strings they
 *    are going to be replaced with an actual `value` and it's type.
 *
 * ## Examples ##
 *
 *
 *      var guards = require("guards");
 *
 *      var gUser = guards.String.extend({ defaults: "Anonymous" });
 *
 *      var user1 = gUser("Jack");
 *      // "Jack"
 *
 *      var user2 = gUser();
 *      // "Anonymous"
 *
 *      var user3 = gUser(7);
 *      // TypeError: String expected instead of number `7`
 *
 *      var gHi = guards.String.extend({
 *        defaults: "Hi",
 *        message: "string expected not a {{type}}"
 *      });
 *
 *      var msg = gHi(function() {});
 *      // TypeError: string expected not a function
 */
exports.String = function String(defaultValue, message) {
  message = message || 'String expected instead of {{type}} `{{value}}`'
  return Guard(isString, defaultValue, message)
}

/**
 * # Number #
 *
 * Function creates a number guard - function that may be used to perform run
 * time type checks on the values. Function takes an optional `defaultValue`
 * that will be returned by a created guard if it's invoked without (or with
 * `undefined`) `value` argument. The `defaultValue` will fallback to
 * `undefined` if not provided. Function also takes another optional argument
 * `message` that represents a template of a message of the `TypeError` that
 * will be thrown by guard if it's invoked with incorrect value.
 *
 * @param {Object|String|Number|function} [defaultValue]
 *    Value that returned guard is going to fall back to if invoked without
 *    a `value` or if it's `undefined`.
 * @param {String} [message]
 *    Optional error message template that will be a message of a `TypeError`
 *    that is will be thrown if returned guard is invoked with a wrong `value`
 *    type. If `message` contains `"{{value}}"` and `"{{type}}"` strings they
 *    are going to be replaced with an actual `value` and it's type.
 *
 * ## examples ##
 *
 *      var guards = require("guards")
 *      var Length = guards.Number(0)
 *
 *      Length()
 *      // 0
 *
 *      Length(17)
 *      // 17
 *
 *      Length("7")
 *      // TypeError: Number expected instead of string `7`
 *
 *      var Count = guards.Number(0, "number expected not a {{type}}")
 *
 *      Count({ value: 4 });
 *      // TypeError: number expected not a object
 */
exports.Number = function Number(defaultValue, message) {
  message = message || 'Number expected instead of {{type}} `{{value}}`'
  return Guard(isNumber, defaultValue, message)
}

exports.Boolean = function Number(defaultValue, message) {
  message = message || 'Boolean expected instead of {{type}} `{{value}}`'
  return Guard(isBoolean, defaultValue, message)
}

exports.Null = function Null(defaultValue, message) {
  message = message || 'null expected instead of {{type}} `{{value}}`'
  return Guard(isNull, defaultValue, message)
}

exports.Undefined = function Undefined(defaultValue, message) {
  message = message || 'undefined expected instead of {{type}} `{{value}}`'
  return Guard(isUndefined, defaultValue, message)
}

});
