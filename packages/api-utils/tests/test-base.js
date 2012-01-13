/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { Base, Class } = require("api-utils/base");

exports["test .isPrototypeOf"] = function(assert) {
  assert.ok(Base.isPrototypeOf(Base.new()),
            "Base is a prototype of Base.new()");
  assert.ok(Base.isPrototypeOf(Base.extend()),
            "Base is a prototype of Base.extned()");
  assert.ok(Base.isPrototypeOf(Base.extend().new()),
            "Base is a prototoype of Base.extend().new()");
  assert.ok(!Base.extend().isPrototypeOf(Base.extend()),
            "Base.extend() in not prototype of Base.extend()");
  assert.ok(!Base.extend().isPrototypeOf(Base.new()),
            "Base.extend() is not prototype of Base.new()");
  assert.ok(!Base.new().isPrototypeOf(Base.extend()),
            "Base.new() is not prototype of Base.extend()");
  assert.ok(!Base.new().isPrototypeOf(Base.new()),
            "Base.new() is not prototype of Base.new()");
};

exports["test inheritance"] = function(assert) {
  var Parent = Base.extend({
    name: "parent",
    method: function () {
      return "hello " + this.name;
    }
  });

  assert.equal(Parent.name, "parent", "Parent name is parent");
  assert.equal(Parent.method(), "hello parent", "method works on prototype");
  assert.equal(Parent.new().name, Parent.name, "Parent instance inherits name");
  assert.equal(Parent.new().method(), Parent.method(),
               "method behaves same on the prototype");
  assert.equal(Parent.extend({}).name, Parent.name,
               "Parent decedent inherits name");

  var Child = Parent.extend({ name: "child" });
  assert.notEqual(Child.name, Parent.name, "Child overides name");
  assert.equal(Child.new().name, Child.name, "Child intsances inherit name");
  assert.equal(Child.extend().name, Child.name,
               "Child decedents inherit name");

  assert.equal(Child.method, Parent.method, "Child inherits method");
  assert.equal(Child.extend().method, Parent.method,
               "Child decedent inherit method");
  assert.equal(Child.new().method, Parent.method,
               "Child instances inherit method");

  assert.equal(Child.method(), "hello child",
               "method refers to instance proprety");
  assert.equal(Child.extend({ name: "decedent" }).new().method(),
               "hello decedent", "method may be overrided");
};

exports["test prototype immutability"] = function(assert) {

  assert.throws(function() {
    var override = function() {};
    Base.extend = override;
    if (Base.extend !== override)
      throw Error("Property was not set");
  }, "Base prototype is imutable");

  assert.throws(function() {
    Base.foo = "bar";
    if (Base.foo !== "bar")
      throw Error("Property was not set");
  }, "Base prototype is non-configurabel");

  assert.throws(function() {
    delete Base.new;
    if ('new' in Base)
      throw Error('Property was not deleted');
  }, "Can't delete properties on prototype");

  var Foo = Base.extend({
    name: 'hello',
    rename: function rename(name) {
      this.name = name;
    }
  });

  assert.throws(function() {
    var override = function() {};
    Foo.extend = override;
    if (Foo.extend !== override)
      throw Error("Property was not set");
  }, "Can't change prototype properties");

  assert.throws(function() {
    Foo.foo = "bar";
    if (Foo.foo !== "bar")
      throw Error("Property was not set");
  }, "Can't add prototype properties");

  assert.throws(function() {
    delete Foo.name;
    if ('new' in Foo)
      throw Error('Property was not deleted');
  }, "Can't remove prototype properties");

  assert.throws(function() {
    Foo.rename("new name");
    if (Foo.name !== "new name")
      throw Error("Property was not modified");
  }, "Method's can't mutate prototypes");

  var Bar = Foo.extend({
    rename: function rename() {
      return this.name;
    }
  });

  assert.equal(Bar.rename(), Foo.name,
               "properties may be overided on decedents");
};

exports['test instance mutability'] = function(assert) {
  var Foo = Base.extend({
    name: "foo",
    init: function init(number) {
      this.number = number;
    }
  });
  var f1 = Foo.new();
  /* V8 does not supports this yet!
  assert.throws(function() {
    f1.name = "f1";
  }, "can't change prototype properties");
  */
  f1.alias = "f1";
  assert.equal(f1.alias, "f1", "instance is mutable");
  delete f1.alias;
  assert.ok(!('alias' in f1), "own properties are deletable");
  f1.init(1);
  assert.equal(f1.number, 1, "method can mutate instance's own properties");
};

exports['test super'] = function(assert) {
  var Foo = Base.extend({
    initialize: function Foo(options) {
      this.name = options.name;
    }
  });

  var Bar = Foo.extend({
    initialize: function Bar(options) {
      Foo.initialize.call(this, options);
      this.type = 'bar';
    }
  });

  var bar = Bar.new({ name: 'test' });

  assert.ok(Bar.isPrototypeOf(bar), 'Bar is prototype of Bar.new');
  assert.ok(Foo.isPrototypeOf(bar), 'Foo is prototype of Bar.new');
  assert.ok(Base.isPrototypeOf(bar), 'Base is prototype of Bar.new');
  assert.equal(bar.type, 'bar', 'bar initializer was called');
  assert.equal(bar.name, 'test', 'bar initializer called Foo initializer');
};

exports['test class'] = function(assert) {
  var Foo = Base.extend({
    type: 'Foo',
    initialize: function(options) {
      this.name = options.name;
    },
    serialize: function serialize() {
      return '<' + this.name + ':' + this.type + '>';
    }
  });
  var CFoo = Class(Foo);
  var f1 = CFoo({ name: 'f1' });
  var f2 = new CFoo({ name: 'f2' });
  var f3 = CFoo.new({ name: 'f3' });
  var f4 = Foo.new({ name: 'f4' });

  assert.ok(f1 instanceof CFoo, 'correct instanceof');
  assert.equal(f1.name, 'f1', 'property initialized');
  assert.equal(f1.serialize(), '<f1:Foo>', 'method works');

  assert.ok(f2 instanceof CFoo, 'correct instanceof when created with new')
  assert.equal(f2.name, 'f2', 'property initialized');
  assert.equal(f2.serialize(), '<f2:Foo>', 'method works');

  assert.ok(f3 instanceof CFoo, 'correct instanceof when created with .new')
  assert.equal(f3.name, 'f3', 'property initialized');
  assert.equal(f3.serialize(), '<f3:Foo>', 'method works');

  assert.ok(f4 instanceof CFoo, 'correct instanceof when created from prototype')
  assert.equal(f4.name, 'f4', 'property initialized');
  assert.equal(f4.serialize(), '<f4:Foo>', 'method works');

  var Bar = Foo.extend({
    type: 'Bar',
    initialize: function(options) {
      this.size = options.size;
      Foo.initialize.call(this, options);
    }
  });
  var CBar = Class(Bar);


  var b1 = CBar({ name: 'b1', size: 1 });
  var b2 = new CBar({ name: 'b2', size: 2 });
  var b3 = CBar.new({ name: 'b3', size: 3 });
  var b4 = Bar.new({ name: 'b4', size: 4 });

  assert.ok(b1 instanceof CFoo, 'correct instanceof');
  assert.ok(b1 instanceof CBar, 'correct instanceof');
  assert.equal(b1.name, 'b1', 'property initialized');
  assert.equal(b1.size, 1, 'property initialized');
  assert.equal(b1.serialize(), '<b1:Bar>', 'method works');

  assert.ok(b2 instanceof CFoo, 'correct instanceof when created with new');
  assert.ok(b2 instanceof CBar, 'correct instanceof when created with new');
  assert.equal(b2.name, 'b2', 'property initialized');
  assert.equal(b2.size, 2, 'property initialized');
  assert.equal(b2.serialize(), '<b2:Bar>', 'method works');

  assert.ok(b3 instanceof CFoo, 'correct instanceof when created with .new');
  assert.ok(b3 instanceof CBar, 'correct instanceof when created with .new');
  assert.equal(b3.name, 'b3', 'property initialized');
  assert.equal(b3.size, 3, 'property initialized');
  assert.equal(b3.serialize(), '<b3:Bar>', 'method works');

  assert.ok(b4 instanceof CFoo, 'correct instanceof when created from prototype');
  assert.ok(b4 instanceof CBar, 'correct instanceof when created from prototype');
  assert.equal(b4.name, 'b4', 'property initialized');
  assert.equal(b4.size, 4, 'property initialized');
  assert.equal(b4.serialize(), '<b4:Bar>', 'method works');
};

require("test").run(exports);

