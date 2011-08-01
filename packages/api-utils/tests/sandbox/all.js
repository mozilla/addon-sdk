const { Cc, Ci, Cu } = require("chrome");

function Sandbox(principal) {
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


exports["test inheritance"] = function (assert) {
  function Type() {}
  let prototype = Type.prototype;
  let sandbox = Sandbox();
  let properties = { a: { value: "a" }, b: { get: function() "b" } };

  let f1 = Object.create(Type.prototype, properties);
  let f2 = sandbox.create(Type.prototype, properties);

  assert.equal(Type.prototype, prototype,
               "prototype did not change (bug 608959)");
  assert.equal(f1.constructor, Type, "constructor is a Type function");
  assert.equal(f2.constructor, f1.constructor,
               "sandbox: constructor is a Type function");
  assert.equal(Object.getPrototypeOf(f1), Type.prototype,
               "prototype is `Type.prototype`");
  assert.equal(Object.getPrototypeOf(f1), sandbox.getPrototypeOf(f1),
               "getPrototypeOf is consistant for local objects");
  assert.equal(Object.getPrototypeOf(f2), sandbox.getPrototypeOf(f2),
               "getPrototypeOf is consistant for sandboxed objects");
};

exports["test writable / non-writable properties"] = function (assert) {
  let sandbox = Sandbox();
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

  let inheritedNonWritable = [ "a", "c" ];
  let inheritedWritable = [ "b" ];
  let ownNonWritable = [ "d", "f" ];
  let ownWritable = [ "e" ];

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
               "property `a` descriptors are undefined");
  assert.equal(Object.getOwnPropertyDescriptor(f1, "b"),
               Object.getOwnPropertyDescriptor(f2, "b"),
               "property `b` descriptors are undefined");
  assert.equal(Object.getOwnPropertyDescriptor(f1, "c"),
               Object.getOwnPropertyDescriptor(f2, "c"),
               "property `c` descriptors are undefined");


  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "d"),
                          Object.getOwnPropertyDescriptor(f2, "d"),
                          "property `d` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "e"),
                          Object.getOwnPropertyDescriptor(f2, "e"),
                          "property `e` descriptors match");
  assert.equalDescriptors(Object.getOwnPropertyDescriptor(f1, "f"),
                          Object.getOwnPropertyDescriptor(f2, "f"),
                          "property `f` descriptors match");

  inheritedNonWritable.forEach(function(name) {
    assert.nonWritable(f1, name, "inherited property `" + name +
                       "` is non-writable");
    assert.nonWritable(f1, name, "sandbox: inherited property `" + name +
                       "` is non-writable");

    assert.writeFails(f1, name, "inherited property `" + name +
                      "` can not be set");
    assert.writeFails(f2, name, "sandbox: inherited property `" + name +
                      "` can not be set");
  });

  inheritedWritable.forEach(function(name) {
    assert.writable(f1, name, "inherited property `" + name + "` is writable");
    assert.writable(f2, name, "sandbox: inherited property `" + name +
                    "` is writable");

    assert.writeSucceeds(f1, name, "inherited writable property `" + name +
                      "` can be set");
    assert.writeSucceeds(f2, name, "sandbox: inherited writable property `" +
                         name + "` can not be set");
  });

  ownNonWritable.forEach(function(name) {
    assert.nonWritable(f1, name, "own property `" + name +
                       "` is non-writable");
    assert.nonWritable(f1, name, "sandbox: own property `" + name +
                       "` is non-writable");

    assert.writeFails(f1, name, "own property `" + name +
                      "` can not be set");
    assert.writeFails(f2, name, "sandbox: own property `" + name +
                      "` can not be set");
  });

  ownWritable.forEach(function(name) {
    assert.writable(f1, name, "own property `" + name + "` is writable");
    assert.writable(f2, name, "sandbox: own property `" + name +
                              "` is writable");

    assert.writeSucceeds(f1, name, "own writable property `" + name +
                      "` can be set");
    assert.writeSucceeds(f2, name, "sandbox: own writable property `" +
                         name + "` can not be set");
  });
};

exports["test configurable / non-configurable properties"] = function (assert) {
  let sandbox = Sandbox();
  let prototype = Object.create(Object.prototype, {
    aa: { value: "aa", configurable: false },
    bb: { value: "bb", configurable: true },
    cc: { value: "cc" },
    dd: { get: function() "dd", configurable: false },
    ee: { get: function() "ee", configurable: true },
    ff: { get: function() "ff" }
  });
  let properties = {
    a: { value: "a", configurable: false },
    b: { value: "b", configurable: true },
    c: { value: "c" },
    d: { get: function() "d", configurable: false },
    e: { get: function() "e", configurable: true },
    f: { get: function() "f" }
  };

  let inheritedNonConfigurable = [ "aa", "cc" ];
  let inheritedNonConfigurableAccessors = [ "dd", "ff" ];
  let inheritedConfigurable = [ "bb" ];
  let inheritedConfigurableAccessors = [ "ee" ];

  let ownNonConfigurable = [ "a", "c" ];
  let ownNonConfigurableAccessors = [ "d", "f" ];
  let ownConfigurable = [ "b" ];
  let ownConfigurableAccessor = [ "e" ]


  let f1 = Object.create(prototype, properties);
  let f2 = sandbox.create(prototype, properties);

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


  inheritedNonConfigurable.forEach(function(name) {
    assert.nonConfigurable(f1, name, "inherited property `" + name +
                           "` is non-configurable");
    assert.nonConfigurable(f1, name, "sandbox: inherited property `" + name +
                           "` is non-configurable");

    assert.deleteSucceeds(f1, name, "inherited property `" + name +
                          "` can be deleted");
    assert.deleteSucceeds(f2, name, "sandbox: inherited property `" + name +
                          "` can not be deleted");

    assert.defineDoesNotThrows(f1, name, "inherited property `" + name +
                               "` can not be redefined");
    assert.defineDoesNotThrows(f2, name, "sandbox: inherited property `"
                               + name + "` can not be redefined");
  });

  inheritedNonConfigurableAccessors.forEach(function(name) {
    assert.nonConfigurable(f1, name, "inherited accessor `" + name +
                           "` is non-configurable");
    assert.nonConfigurable(f1, name, "sandbox: inherited accessor `" + name +
                           "` is non-configurable");

    assert.deleteFails(f1, name, "inherited accessor `" + name +
                          "` can not be deleted");
    /* Fails because of platform bug!
    assert.deleteFails(f2, name, "sandbox: inherited accessor `" + name +
                          "` can not be deleted");
    */

    assert.defineDoesNotThrows(f1, name, "inherited accessor `" + name +
                               "` can not be redefined");

    assert.defineDoesNotThrows(f2, name, "sandbox: inherited accessor `"
                               + name + "` can not be redefined");
  });

  inheritedConfigurable.forEach(function(name) {
    assert.configurable(f1, name, "inherited property `" + name +
                        "` is configurable");
    assert.configurable(f2, name, "sandbox: inherited property `" + name +
                        "` is configurable");

    assert.deleteSucceeds(f1, name, "inherited property `" + name +
                          "` can be deleted");
    assert.deleteSucceeds(f2, name, "sandbox: inherited property `" + name +
                          "` can be deleted");

    assert.defineDoesNotThrows(f1, name, "inherited property `" + name +
                               "` can be redefined");
    assert.defineDoesNotThrows(f2, name, "sandbox: inherited property `"
                               + name + "` can be redefined");
  });

  inheritedConfigurableAccessors.forEach(function(name) {
    assert.configurable(f1, name, "inherited property `" + name +
                        "` is configurable");
    assert.configurable(f2, name, "sandbox: inherited property `" + name +
                        "` is configurable");

    assert.deleteSucceeds(f1, name, "inherited property `" + name +
                          "` can be deleted");
    assert.deleteSucceeds(f2, name, "sandbox: inherited property `" + name +
                          "` can be deleted");

    assert.defineDoesNotThrows(f1, name, "inherited property `" + name +
                               "` can be redefined");
    assert.defineDoesNotThrows(f2, name, "sandbox: inherited property `"
                               + name + "` can be redefined");
  });


  ownNonConfigurable.forEach(function(name) {
    assert.nonConfigurable(f1, name, "own property `" + name +
                           "` is non-configurable");
    assert.nonConfigurable(f1, name, "sandbox: own property `" + name +
                           "` is non-configurable");

    assert.deleteFails(f1, name, "own property `" + name +
                       "` can not be deleted");
    assert.deleteFails(f2, name, "sandbox: own property `" + name +
                       "` can not be deleted");

    assert.defineThrows(f1, name, "own property `" + name +
                        "` can not be redefined");

    /* Fails because of platform bug!
    assert.defineThrows(f2, name, "sandbox: inherited property `" + name +
                        "` can not be redefined");
    */
  });

  ownNonConfigurableAccessors.forEach(function(name) {
    assert.nonConfigurable(f1, name, "own accessor `" + name +
                           "` is non-configurable");
    assert.nonConfigurable(f1, name, "sandbox: own accessor `" + name +
                           "` is non-configurable");

    assert.deleteFails(f1, name, "own accessor `" + name +
                       "` can not be deleted");
    assert.deleteFails(f2, name, "sandbox: own accessor `" + name +
                       "` can not be deleted");

    assert.defineThrows(f1, name, "own accessor `" + name +
                        "` can not be redefined");

    assert.defineThrows(f2, name, "sandbox: accessor property `" + name +
                        "` can not be redefined");
  });

  ownConfigurableAccessor.forEach(function(name) {
    assert.configurable(f1, name,
                        "own accessor `" + name + "` is configurable");
    assert.configurable(f2, name,
                        "sandbox: own accessor `" + name + "` is configurable");

    assert.deleteSucceeds(f1, name, "own accessor `" + name +
                          "` can be deleted");
    assert.deleteSucceeds(f2, name, "sandbox: own accessor `" + name +
                          "` can be deleted");

    assert.defineDoesNotThrows(f1, name, "own accessor `" + name +
                               "` can be redefined");

    /* Fails because of platform bug!
    assert.defineDoesNotThrows(f2, name, "sandbox: own accessor `" + name +
                               "` can be redefined");
    */
  });
};

exports["test enumerable / non-enumerable properties"] = function (assert) {
  let sandbox = Sandbox();
  let properties = {
    a: { value: "a", enumerable: false },
    b: { value: "b", enumerable: true },
    c: { value: "c" },
    d: { get: function() "d", enumerable: false },
    e: { get: function() "e", enumerable: true },
    f: { get: function() "f" }
  };

  let enumerable = [ "b", "e" ];
  let nonEnumerable = [ "a", "c", "d", "f" ];

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

  enumerable.forEach(function (name) {
    assert.enumerable(f1, name, "`" + name + "` is enumerable");
    assert.enumerable(f2, name, "sandbox: `" + name + "` is enumerable");

    assert.isEnumerated(f1, name, "`" + name + "` is enumerated");
    assert.isEnumerated(f2, name, "sandbox: `" + name + "` is enumerated");
  });

  nonEnumerable.forEach(function (name) {
    assert.nonEnumerable(f1, name, "`" + name + "` is non-enumerable");
    assert.nonEnumerable(f2, name, "sandbox: `" + name + "` is non-enumerable");

    assert.isNotEnumerated(f1, name, "`" + name + "` is not enumerated");
    assert.isNotEnumerated(f2, name, "sandbox: `" + name + "` is not enumerated");
  });
};

exports["test property names / keys"] = function (assert) {
  let sandbox = Sandbox();
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

  assert.equal(Object.getOwnPropertyNames(f1).length, 6, "2 own properties");
  assert.equal(Object.getOwnPropertyNames(f2).length, 6,
               "sandbox: 6 own properties");
  assert.equal(sandbox.getOwnPropertyNames(f1).length, 6,
               "`getOwnPropertyNames` from sandbox reports 6 own properties");
  assert.equal(sandbox.getOwnPropertyNames(f2).length, 6,
               "`getOwnPropertyNames` from sandbox reports 6 own properties");

  assert.equal(Object.keys(f1).length, 2,
               "local keys returns 4 properties on local object");
  assert.equal(Object.keys(f2).length, 2,
               "local keys returns 4 properties on sandboxed object");
  assert.equal(sandbox.keys(f1).length, 2,
               "sandboxed keys returns 4 properties on local object");
  assert.equal(sandbox.keys(f2).length, 2,
               "sandboxed keys returns 4 properties on sandboxed object");
};

require("test").run(exports);
