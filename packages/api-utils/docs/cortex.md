# Cortex #

## property encapsulation ##

In JavaScript it is not possible to create properties that have limited or
controlled accessibility. It is possible to create non-enumerable and
non-writable properties, but still they can be discovered and accessed.
Usually so called "closure capturing" is used to encapsulate such properties
in lexical scope:

    function Foo() {
      var _secret = 'secret';
      this.hello = function hello() {
        return 'Hello ' + _secret;
      }
    }

This provides desired result, but has side effect of degradet code readability,
specially with object-oriented programs. Another disadvantage with this pattern
is that there is no immediate solution for inheriting access to the privates
(illustrated by the following example):

    function Derived() {
      this.hello = function hello() {
        return _secret;
      }
      this.bye = functino bye() {
        return _secret;
      }
    }
    Derived.prototype = Object.create(Foo.prototype);

## facade objects ##

Alternatively constructor can returned facade objects - proxies to the
instance's public properties:

    function Foo() {
      var foo = Object.create(Foo.prototype);
      return {
        bar: foo.hello.bind(foo);
      }
    }
    Foo.prototype._secret = 'secret';
    Foo.prototype.hello = function hello() {
      return 'Hello ' + this._secret;
    }

    function Derived() {
      var derived = Object.create(Derived.prototype);
      return {
        bar: derived.hello.bind(derived);
        bye: derived.bye.bind(derived);
      }
    }
    Derived.prototype = Object.create(Foo.prototype);
    Derived.prototype.bye = function bye() {
      return 'Bye ' + this._secret;
    };

While this solution solves given issue and provides proper encapsulation for
both own and inherited private properties, it does not addresses following:

 - Privates defined on the `prototype` can be compromised, since they are
   accessible through the constructor (`Foo.prototype._secret`).
 - Behavior of `instanceof` is broken, since `new Derived() instanceof Derived`
   is going to evaluate to `false`.

## Temper proving with property descriptor maps ##

In ES5 new property descriptor maps were introduced, which can be used as a
building blocks for defining reusable peace of functionality. At some degree
they are similar to a `prototype` objects, and can be used so to define peaces
of functionality that is considered to be private (In constrast to `prototype`
they are not exposed by default).

    function Foo() {
      var foo = Object.create(Foo.prototype, FooDescriptor);
      var facade = Object.create(Foo.prototype);
      facade.hello = foo.hello.bind(foo);
      return facade;
    }
    Foo.prototype.hello = function hello() {
      return 'Hello ' + this._secret;
    }
    var FooDescriptor = {
      _secret: { value: 'secret' };
    }

    function Derived() {
      var derived = Object.create(Derived.prototype, DerivedDescriptor);
      var facade = Object.create(Derived.prototype);
      facade.hello = derived.hello.bind(derived)
      facade.bye = derived.bye.bind(derived)
      return facade
    }
    Derived.prototype = Object.create(Foo.prototype)
    Derived.prototype.bye = function bye() {
      return 'Bye ' + this._secret
    }
    DerivedDescriptor = {}

    Object.keys(FooDescriptor).forEach(function(key) {
      DerivedDescriptor[key] = FooDescriptor[key]
    })

## cortex objects ##

Last approach solves all of the concerns, but adds complexity, verbosity
and decreases code readability. Combination of `cortex`'s and `Trait`'s
will gracefully solve all these issues and keep code clean:

    var cortex = require('cortex').cortex;
    var Trait = require('light-traits').Trait;

    var TFoo = Trait({
      _secret: 'secret',
      hello: function hello() {
        return 'Hello ' + this._secret;
      }
    });
    function Foo() {
      return cortex(TFoo.create(Foo.prototype));
    }

    var TDerived = Trait.compose(TFoo, Trait({
      bye: function bye() {
        return 'Bye ' this._secret;
      }
    }));
    function Derived() {
      var derived = TDerived.create(Derived.prototype);
      return cortex(derived);
    }

Function `cortex` takes any object and returns a proxy for it's public
properties. By default properties are considered to be public if they don't
start with `"_"`, but default behavior can be overided if needed, by passing
array of public property names as a second argument.

## Gotchas ##

- `cortex` is just an utility function to create a proxy objet and it does not
  solves `prototype` related issue highlighted earlier, but since traits make
  use of property descriptor maps instead of `prototype` it is not an issue. In
  case you want to use `cortex` function with an objects that make use of
  `prototype` chain you should ethier make sure that you don't have any private
  properties that could be compromised or alternatively you can call `cortex`
  with third optional `prototype` argument. In later case returned proxy will
  inherit from the given prototype and `prototype` chain of wrapped object will
  be unaccessible, also you should be awary that in such case behavior of
  `instanceof` will be different.
