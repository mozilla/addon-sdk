"use strict"

var utils = require("utils/type");

exports["test function"] = function (assert) {
  assert.ok(utils.isFunction(function(){}), "value is function");
  assert.ok(utils.isFunction(Object), "Object is function");
  assert.ok(utils.isFunction(new Function("")), "Genertaed value is function");
  assert.ok(!utils.isFunction({}), "object is not a function");
  assert.ok(!utils.isFunction(4), "number is not a function");
};

exports["test atoms"] = function (assert) {
  assert.ok(utils.isAtom(2), "number is atom");
  assert.ok(utils.isAtom(NaN), "`NaN` is atom");
  assert.ok(utils.isAtom(undefined), "`undefined` is atom");
  assert.ok(utils.isAtom(null), "`null` is atom");
  assert.ok(utils.isAtom(Infinity), "`Infinity` is atom");
  assert.ok(utils.isAtom("foo"), "strings are atoms");
  assert.ok(utils.isAtom(true) && utils.isAtom(false), "booleans are atoms");
};

exports["test object"] = function (assert) {
  assert.ok(utils.isObject({}), "`{}` is object");
  assert.ok(!utils.isObject(null), "`null` is not an object");
  assert.ok(!utils.isObject(Object), "functions is not an object");
};

exports["test flat objects"] = function (assert) {
  assert.ok(utils.isFlat({}), "`{}` is a plain object");
  assert.ok(!utils.isFlat([]), "`[]` is not a plain object");
  assert.ok(!utils.isFlat(new function() {}), "derived objects are not plain");
};

exports["test json atoms"] = function (assert) {
  assert.ok(utils.isJSON(null), "`null` is JSON");
  assert.ok(utils.isJSON(undefined), "`undefined` is JSON");
  assert.ok(utils.isJSON(NaN), "`NaN` is JSON");
  assert.ok(utils.isJSON(Infinity), "`Infinity` is JSON");
  assert.ok(utils.isJSON(true) && utils.isJSON(false), "booleans are JSON");
  assert.ok(utils.isJSON(4), utils.isJSON(0), "numbers are JSON");
  assert.ok(utils.isJSON("foo bar"), "strings are JSON");
};

exports["test json"] = function (assert) {
  assert.ok(!utils.isJSON(function(){}), "functions are not json");
  assert.ok(utils.isJSON({}), "`{}` is JSON");
  assert.ok(utils.isJSON({
              a: "foo",
              b: 3,
              c: undefined,
              d: null,
              e: {
                f: {
                  g: "bar",
                  p: [{}, "oueou", 56]
                },
                q: { nan: NaN, infinity: Infinity },
                "non standard name": "still works"
              }
            }), "JSON can contain nested objects");

  var foo = {};
  var bar = { foo: foo };
  foo.bar = bar;
  assert.ok(!utils.isJSON(foo), "recursive objects are not json");


  assert.ok(!utils.isJSON({ get foo() { return 5 } }),
            "json can not have getter");

  assert.ok(!utils.isJSON({ foo: "bar", baz: function () {} }),
            "json can not contain functions");

  assert.ok(!utils.isJSON(Object.create({})),
            "json must be direct decedant of `Object.prototype`");
};

if (module == require.main)
  require("test").run(exports);
