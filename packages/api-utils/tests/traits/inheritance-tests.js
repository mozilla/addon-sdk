"use strict";

var Trait = require("light-traits").Trait;

exports["test custom constructor and inherited toString"] = function(assert) {
  function Type() {
    return Object.create(Type.prototype);
  }
  Type.prototype = Trait({
    method: function method() {
      return 2;
    }
  }).create(Object.freeze(Type.prototype));

  var fixture = Type();

  assert.equal(fixture.constructor, Type, "must override constructor");
  assert.equal(fixture.toString(), "[object Type]", "must inherit toString");
};

exports["test custom toString and inherited constructor"] = function(assert) {
  function Type() {
    return Object.create(Type.prototype);
  }
  Type.prototype = Trait({
    toString: function toString() {
      return "<toString>";
    }
  }).create();

  var fixture = Type();

  assert.equal(fixture.constructor, Trait, "must inherit constructor Trait");
  assert.equal(fixture.toString(), "<toString>", "Must override toString");
};

exports["test custom toString and constructor"] = function(assert) {
  function Type() {
    return TypeTrait.create(Type.prototype);
  }
  Object.freeze(Type.prototype);
  var TypeTrait = Trait({
    toString: function toString() {
      return "<toString>";
    }
  });

  var fixture = Type();
  
  assert.equal(fixture.constructor, Type, "constructor is provided to create");
  assert.equal(fixture.toString(), "<toString>", "toString was overridden");
};

if (require.main == module)
  require("test").run(exports);
