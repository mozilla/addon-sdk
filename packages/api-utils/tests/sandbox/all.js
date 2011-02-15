const { Cc, Ci, Cu } = require("chrome");

function Sandboxed(principal) {
  let sandbox = Cu.Sandbox(principal || "http://www.mozilla.com/");
  return Cu.evalInSandbox("({" +
  " create: function create(prototype, descriptor) {" +
  "   return Object.create(prototype, descriptor);" +
  " }," +
  " getPrototypeOf: function getPrototypeOf(object) {" +
  "   return Object.getPrototypeOf(object);" +
  " }," +
  " defineProperty: function defineProperty(object, name, descriptor) {" +
  "   return Object.defineProperty(object, name, descriptor);" +
  " }," +
  " defineProperties: function defineProperties(object, map) {" +
  "   return Object.defineProperties(object, map);" +
  " }," +
  " keys: function keys(object) {" +
  "   return Object.keys(object);" +
  " }," + 
  " getOwnPropertyNames: function getOwnPropertyNames(object) {" +
  "   return Object.getOwnPropertyNames(object);" +
  " }," +
  " getOwnPropertyDescriptor: function getOwnPropertyDescriptor(value, key) {" +
  "   return Object.getOwnPropertyDescriptor(value, key);" +
  " }," +
  "})", sandbox);
};

exports.Assert = require("./asserts").create(Object);
exports["test inheritence"] = function (assert) {
  function Type() {}
  let prototype = Type.prototype;
  let sandbox = Sandboxed();
  let properties = { a: { value: "a" }, b: { get: function() "b" } };

  let f1 = Object.create(Type.prototype, properties);
  let f2 = Object.create(Type.prototype, properties);

  assert.equal(Type.prototype, prototype, "prototype did not changed");
  assert.equal(f1.constructor, Type, "consturctor is a Type function");
  assert.equal(f2.constructor, Type, "sandbox: consturctor is a Type function");
  assert.equal(Object.getPrototypeOf(f1), Type.prototype,
               "prototype is `Type.prototype`");
  assert.equal(sandbox.getPrototypeOf(f1), Type.prototype,
               "`getPrototypeOf` in sandbox returs `Type.prototype`");
  assert.equal(Object.getPrototypeOf(f2), Type.prototype,
               "sandbox: prototype is `Type.prototype`");
  assert.equal(sandbox.getPrototypeOf(f2), Type.prototype,
               "getPrototypeOf in sandbox returns `Type.prototype`");
};

exports["test writable / non-writable properties"] = function (assert) {
  let sandbox = Sandboxed();
  let prototype = Object.create(Object.prototype, {
    a: { value: "a", writable: false },
    b: { value: "b", writable: true },
    c: { value: "c" }
  });
  let properties = {
    d: { value: "d", writable: false },
    e: { value: "e", writable: true },
    f: { value: "f" }
  };

  let f1 = Object.create(prototype, properties);
  let f2 = sandbox.create(prototype, properties);

  assert.equal(f1.a, f2.a, "property `a` values match");
  assert.equal(f1.b, f2.b, "property `b` values match");
  assert.equal(f1.c, f2.c, "property `c` values match");
  assert.equal(f1.d, f2.d, "property `d` values match");
  assert.equal(f1.e, f2.e, "property `e` values match");
  assert.equal(f1.f, f2.f, "property `f` values match");

  assert.equal(Object.getOwnPropertyDescriptor(f1, "a"),
               Object.getOwnPropertyDescriptor(f2, "a"),
               "proprety `a` descriptors are undefined");
  assert.equal(Object.getOwnPropertyDescriptor(f1, "b"),
               Object.getOwnPropertyDescriptor(f2, "b"),
               "proprety `c` descriptors are undefined");
  assert.equal(Object.getOwnPropertyDescriptor(f1, "c"),
               Object.getOwnPropertyDescriptor(f2, "c"),
               "proprety `c` descriptors are undefined");


  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "d"),
                          Object.getOwnPropertyDescriptor(f2, "d"),
                          "property `d` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "e"),
                          Object.getOwnPropertyDescriptor(f2, "e"),
                          "property `e` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "f"),
                          Object.getOwnPropertyDescriptor(f2, "f"),
                          "property `f` descriptors match");

  assert.nonWritable(f1, "a", "property `a` is non-writable");
  assert.nonWritable(f2, "a", "sandbox: property `a` is non-writable");
  assert.nonWritable(f1, "c", "property `c` is non-writable");
  assert.nonWritable(f2, "c", "sandbox: property `d` is non-writable");
  assert.nonWritable(f1, "d", "property `i` is non-writable");
  assert.nonWritable(f2, "d", "sandbox: property `a` is non-writable");
  assert.nonWritable(f1, "f", "property `f` is non-writable");
  assert.nonWritable(f2, "f", "sandbox: property `f` is non-writable");

  f1.b = f2.b = f1.e = f2.e = "<value>";

  assert.equal(f1.b, f2.b, "property `b` values are the same after set");
  assert.equal(f1.e, f2.e, "property `e` values are the same after set");
  assert.equal(f1.b, f2.e, "all writable propeperties changed");
};

exports["test configurable / non-configurable properties"] = function (assert) {
  let sandbox = Sandboxed();
  let properties = {
    a: { value: "a", configurable: false },
    b: { value: "b", configurable: true },
    c: { value: "c" },
    d: { get: function() "d", configurable: false },
    e: { get: function() "e", configurable: true },
    f: { get: function() "f" }
  };

  let override = { value: "<override>" };

  let f1 = Object.create(Object.prototype, properties);
  let f2 = sandbox.create(Object.prototype, properties);

  assert.equal(f1.a, f2.a, "property `a` values match");
  assert.equal(f1.b, f2.b, "property `b` values match");
  assert.equal(f1.c, f2.c, "property `c` values match");
  assert.equal(f1.d, f2.d, "property `d` values match");
  assert.equal(f1.e, f2.e, "property `e` values match");
  assert.equal(f1.f, f2.f, "property `f` values match");

  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "a"),
                          Object.getOwnPropertyDescriptor(f2, "a"),
                          "property `a` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "b"),
                          Object.getOwnPropertyDescriptor(f2, "b"),
                          "property `b` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "c"),
                          Object.getOwnPropertyDescriptor(f2, "c"),
                          "property `c` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "d"),
                          Object.getOwnPropertyDescriptor(f2, "d"),
                          "property `d` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "e"),
                          Object.getOwnPropertyDescriptor(f2, "e"),
                          "property `e` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "f"),
                          Object.getOwnPropertyDescriptor(f2, "f"),
                          "property `f` descriptors match");

  assert.nonConfigurable(f1, "a", "property `a` is non-configurable");
  assert.nonConfigurable(f2, "a",
                         "sandbox: property `a` is non-configurable");
  assert.nonConfigurable(f1, "c",
                         "property `c` defaults to non-configurable");
  assert.nonConfigurable(f2, "c",
                         "sandbox: property `d` defaults to non-configurable");
  assert.nonConfigurable(f1, "d", "property `d` is non-configurable");
  assert.nonConfigurable(f2, "d",
                         "sandbox: property `d` is non-configurable");
  assert.nonConfigurable(f1, "f", "property `f` defaults to non-configurable");
  assert.nonConfigurable(f2, "f",
                         "sandbox: property `f` defaults to non-configurable");

  Object.defineProperty(f1, "b", override);
  Object.defineProperty(f2, "b", override);
  Object.defineProperty(f1, "e", override);
  Object.defineProperty(f2, "e", override);

  assert.equal(f1.b, f2.b, "property `b` values are the same after redefine");
  assert.equal(f1.e, f2.e, "property `e` values are the same after redifine");
  assert.equal(f1.b, f2.e, "all propeperties redefined to same");

  delete f1.b;
  delete f2.b;
  delete f1.e;
  delete f2.e;

  assert.ok(!('b' in f1), "property `b` was deleted");
  assert.ok(!('b' in f2), "sandbox: property `b` was deleted");
  assert.ok(!('e' in f1), "property `e` was deleted");
  assert.ok(!('e' in f2), "sandbox: property `e` was deleted");
};


exports["test enumerable / non-enumerable properties"] = function (assert) {
  let sandbox = Sandboxed();
  let properties = {
    a: { value: "a", enumerable: false },
    b: { value: "b", enumerable: true },
    c: { value: "c" },
    d: { get: function() "d", enumerable: false },
    e: { get: function() "e", enumerable: true },
    f: { get: function() "f" }
  };

  let f1 = Object.create(Object.prototype, properties);
  let f2 = sandbox.create(Object.prototype, properties);

  assert.equal(f1.a, f2.a, "property `a` values match");
  assert.equal(f1.b, f2.b, "property `b` values match");
  assert.equal(f1.c, f2.c, "property `c` values match");
  assert.equal(f1.d, f2.d, "property `d` values match");
  assert.equal(f1.e, f2.e, "property `e` values match");
  assert.equal(f1.f, f2.f, "property `f` values match");

  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "a"),
                          Object.getOwnPropertyDescriptor(f2, "a"),
                          "property `a` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "b"),
                          Object.getOwnPropertyDescriptor(f2, "b"),
                          "property `b` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "c"),
                          Object.getOwnPropertyDescriptor(f2, "c"),
                          "property `c` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "d"),
                          Object.getOwnPropertyDescriptor(f2, "d"),
                          "property `d` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "e"),
                          Object.getOwnPropertyDescriptor(f2, "e"),
                          "property `e` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "f"),
                          Object.getOwnPropertyDescriptor(f2, "f"),
                          "property `f` descriptors match");

  assert.nonEnumerable(f1, "a", "property `a` is non-enumerable");
  assert.nonEnumerable(f2, "a",
                       "sandbox: property `a` is non-enumerable");
  assert.nonEnumerable(f1, "c",
                       "property `c` defaults to non-enumerable");
  assert.nonEnumerable(f2, "c",
                       "sandbox: property `d` defaults to non-enumerable");
  assert.nonEnumerable(f1, "d", "property `d` is non-enumerable");
  assert.nonEnumerable(f2, "d",
                       "sandbox: property `d` is non-enumerable");
  assert.nonEnumerable(f1, "f", "property `f` defaults to non-enumerable");
  assert.nonEnumerable(f2, "f",
                       "sandbox: property `f` defaults to non-enumerable");
};

exports["property names / keys"] = function (assert) {
  let sandbox = Sandboxed();
  let properties = {
    a: { value: "a", enumerable: false },
    b: { value: "b", enumerable: true },
    c: { value: "c" },
    d: { get: function() "d", enumerable: false },
    e: { get: function() "e", enumerable: true },
    f: { get: function() "f" }
  };

  let f1 = Object.create(Object.prototype, properties);
  let f2 = sandbox.create(Object.prototype, properties);

  assert.equal(Object.keys(f1).length, 6, "6 own properties");
  assert.equal(Object.keys(f2).length, 6,
               "sandbox: 6 own properties");
  assert.equal(sandbox.keys(f1).length, 6,
               "`getOwnPropertyNames` from sandbox reports 6 own properties");
  assert.equal(sandbox.keys(f2).length, 6,
               "`getOwnPropertyNames` from sandbox reports 6 own properties");

  assert.equal(Object.keys(f1).length, 4, "4 own enumerable properties");
  assert.equal(Object.keys(f2).length, 4,
               "sandbox: 6 own enumerable properties");
  assert.equal(sandbox.keys(f1).length, 4,
               "`keys` from sandbox reports 4 own properties");
  assert.equal(sandbox.keys(f2).length, 4,
               "`keys` from sandbox reports 4 own properties");

};

if (module == require.main)
  require("test").run(exports);
