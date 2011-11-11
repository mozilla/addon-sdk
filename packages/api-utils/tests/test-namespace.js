"use strict";

let { Namespace } = require("api-utils/namespace");

exports["test namsepace basics"] = function(assert) {
  var privates = Namespace();
  var object = { foo: function foo() { return "hello foo"; } };

  assert.notEqual(privates(object), object,
                  "namespaced object is not the same");
  assert.ok(!('foo' in privates(object)),
            "public properties are not in the namespace");

  assert.equal(privates(object), privates(object),
               "same namespaced object is returned on each call");
};

exports["test namespace overlays"] = function(assert) {
  var _ = new Namespace();
  var object = { foo: 'foo' };

  _(object).foo = 'bar';

  assert.equal(_(object).foo, "bar",
               "namespaced property `foo` changed value");

  assert.equal(object.foo, "foo",
               "public property `foo` has original value");

  object.foo = "baz";
  assert.equal(_(object).foo, "bar",
               "property changes do not affect namsepaced properties");

  object.bar = "foo";
  assert.ok(!("bar" in _(object)),
              "new public properties are not reflected in namespace");
};

exports["test shared namespaces"] = function(assert) {
  var _ = new Namespace({ hello: 'hello world' });

  var f1 = { hello: 1 };
  var f2 = { foo: 'foo' };

  assert.equal(_(f1).hello, _(f2).hello, "namespace can be shared");
  assert.notEqual(f1.hello, _(f1).hello, "shared namespace can overlay");
  assert.notEqual(f2.hello, _(f2).hello, "target is not affected");

  _(f1).hello = 2;

  assert.notEqual(_(f1).hello, _(f2).hello,
                  "namespaced property can be overided");
  assert.equal(_(f2).hello, _({}).hello, "namespace does not change");
};

exports["test multi namespace"] = function(assert) {
  var n1 = new Namespace();
  var n2 = new Namespace();
  var object = { baz: 1 };
  n1(object).foo = 1;
  n2(object).foo = 2;
  n1(object).bar = n2(object).bar = 3;

  assert.notEqual(n1(object).foo, n2(object).foo,
                  "object can have multiple namespaces");
  assert.equal(n1(object).bar, n2(object).bar,
               "object can have matiching props in diff namespaces");
};

require("test").run(exports);
