<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Set of utility functions for dealing with object oriented paradigm but
with a comfort of and power of functional composition.

<api name="chainable">
@function
Creates a version of the input function that will return `this`.

    let { chain } = require("sdk/util/oops");

    function Person (age) { this.age = age; }
    Person.prototype.happyBirthday = chain(function () this.age++);

    let person = new Person(30);

    person
      .happyBirthday()
      .happyBirthday()
      .happyBirthday()

    console.log(person.age); // 33

@param fn {function}
  The function that will be wrapped by the chain function.

@returns {function}
  The wrapped function that executes `fn` and returns `this`.
</api>

<api name="field">
@function

Takes field `name` and `target` and returns value of that field.
If `target` is `null` or `undefined` it would be returned back
instead of attempt to access it's field. Function is implicitly
curried, this allows accessor function generation by calling it
with only `name` argument.

    let { field } = require("sdk/util/oops");

    field("x", { x: 1, y: 2})     // => 1
    field("x")({ x: 1 })          // => 1
    field("x", { y: 2 })          // => undefiend

    let getX = field("x")
    getX({ x: 1 })               // => 1
    getX({ y: 1 })               // => undefined
    getX(null)                   // => null

@param name {string}
  Name of the field to be returned

@param target {object}
  Target to get a field by the given `name` from

@returns
  Field value
</api>

<api name="query">
@function

Takes `.` delimited string representing `path` to a nested field
and a `target` to get it from. For convinience function is
implicitly curried, there for accessors can be created by invoking
it with just a `path` argument.

    let { query } = require("sdk/util/oops");

    query("x", { x: 1, y: 2})           // => 1
    query("top.x", { x: 1 })            // => undefiend
    query("top.x", { top: { x: 2 } })   // => 2

    let topX = query("top.x")
    topX({ top: { x: 1 } })             // => 1
    topX({ y: 1 })                      // => undefined
    topX(null)                          // => null

@param path {string}
  `.` delimited path to a field

@param target {object}
  Target to get a field by the given `name` from

@returns
  Field value
</api>

<api name="isInstance">
Takes `Type` (constructor function) and a `value` and returns
`true` if `value` is instance of the given `Type`. Function is
implicitly curried this allows predicate generation by calling
function with just first argument.

    let { isInstance } = require("sdk/util/oops");

    function X() {}
    function Y() {}
    let isX = isInstance(X);

    isInstance(X, new X);     // true
    isInstance(X)(new X);     // true
    isInstance(X, new Y);     // false
    isInstance(X)(new Y);     // false

    isX(new X);               // true
    isX(new Y);               // false

@param Type {function}
  Type (constructor function)

@param instance {object}
  Instance to test

@returns {boolean}
</api>