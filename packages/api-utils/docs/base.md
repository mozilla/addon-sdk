### Inheritance ###

Doing [inheritance in JavaScript](https://developer.mozilla.org/en/Introduction_to_Object-Oriented_JavaScript)
is both verbose and painful. Reading or writing such code requires requires
sharp eye and lot's of discipline, mainly due to code fragmentation and lots of
machinery exposed:

    // Defining a simple Class
    function Dog(name) {
      // Classes are for creating instances, calling them without `new` changes
      // behavior, which in majority cases you need to handle, so you end up
      // with additional boilerplate.
      if (!(this instanceof Dog)) return new Dog(name);

      this.name = name;
    };
    // To define methods you need to make a dance with a special 'prototype'
    // property of the constructor function. This is too much machinery exposed.
    Dog.prototype.type = 'dog';
    Dog.prototype.bark = function bark() {
      return 'Ruff! Ruff!'
    };

    // Subclassing a `Dog`
    function Pet(name, breed) {
      // Once again we do our little dance 
      if (!(this instanceof Pet)) return new Pet(name, breed);

      Dog.call(this, name);
      this.breed = breed;
    }
    // To subclass, you need to make another special dance with special
    // 'prototype' properties.
    Pet.prototype = Object.create(Dog.prototype);
    // If you want correct instanceof behavior you need to make a dance with
    // another special `constructor` property of the `prototype` object.
    Object.defineProperty(Pet.prototype, 'contsructor', { value: Pet });
    // Finally you can define some properties.
    Pet.prototype.call = function(name) {
      return this.name === name ? this.bark() : '';
    };

An "exemplar" is a factory for instances. Usually exemplars are defined as
(constructor) functions as in examples above. But that does not necessary has
to be the case. Prototype (object) can form far more simpler exemplars. After
all what could be more object oriented than objects that inherit from objects.

    var Dog = {
      new: function(name) {
        var instance = Object.create(this);
        this.initialize.apply(instance, arguments);
        return instance;
      },
      initialize: function initialize(name) {
        this.name = name;
      },
      type: 'dog',
      bark: function bark() {
        return 'Ruff! Ruff!'
      }
    };
    var fluffy = Dog.new('fluffy');


    var Pet = Object.create(Dog);
    Pet.initialize = function initialize(name, breed) {
      Dog.initialize.call(this, name);
      this.breed = breed;
    };
    Pet.call = function call(name) {
      return this.name === name ? this.bark() : '';
    };

While this small trick solves some readability issues, there are still more. To
address them this module exports `Base` exemplar with few methods predefined:

    var Dog = Base.extend({
      initialize: function initialize(name) {
        this.name = name;
      },
      type: 'dog',
      bark: function bark() {
        return 'Ruff! Ruff!'
      }
    });

    var Pet = Dog.extend({
      initialize: function initialize(name, breed) {
        Dog.initialize.call(this, name);
        this.breed = breed;
      },
      function call(name) {
        return this.name === name ? this.bark() : '';
      }
    });

    var fluffy = Dog.new('fluffy');
    dog.bark();                       // 'Ruff! Ruff!'
    Dog.isPrototypeOf(fluffy);        // true
    Pet.isPrototypeOf(fluffy);        // true

### Composition ###

Even though (single) inheritance is very powerful it's not always enough.
Sometimes it's more useful suitable to define reusable pieces of functionality
and then compose bigger pieces out of them:

    var HEX = Base.extend({
      hex: function hex() {
        return '#' + this.color
      }
    })

    var RGB = Base.extend({
      red: function red() {
        return parseInt(this.color.substr(0, 2), 16)
      },
      green: function green() {
        return parseInt(this.color.substr(2, 2), 16)
      },
      blue: function blue() {
        return parseInt(this.color.substr(4, 2), 16)
      }
    })

    var CMYK = Base.extend(RGB, {
      black: function black() {
        var color = Math.max(Math.max(this.red(), this.green()), this.blue())
        return (1 - color / 255).toFixed(4)
      },
      magenta: function magenta() {
        var K = this.black();
        return (((1 - this.green() / 255).toFixed(4) - K) / (1 - K)).toFixed(4)
      },
      yellow: function yellow() {
        var K = this.black();
        return (((1 - this.blue() / 255).toFixed(4) - K) / (1 - K)).toFixed(4)
      },
      cyan: function cyan() {
        var K = this.black();
        return (((1 - this.red() / 255).toFixed(4) - K) / (1 - K)).toFixed(4)
      }
    })

    // Composing `Color` prototype out of reusable components:
    var Color = Base.extend(HEX, RGB, CMYK, {
      initialize: function initialize(color) {
        this.color = color
      }
    })

    var pink = Color.new('FFC0CB')
    // RGB
    pink.red()        // 255
    pink.green()      // 192
    pink.blue()       // 203

    // CMYK
    pink.magenta()    // 0.2471
    pink.yellow()     // 0.2039
    pink.cyan()       // 0.0000

### Combining composition & inheritance ###

Also it's easy to mix composition with inheritance:

    var Pixel = Color.extend({
      initialize: function initialize(x, y, color) {
        Color.initialize.call(this, color)
        this.x = x
        this.y = y
      },
      toString: function toString() {
        return this.x + ':' + this.y + '@' + this.hex()
      }
    });

    var pixel = Pixel.new(11, 23, 'CC3399');
    pixel.toString()              // 11:23@#CC3399
    Pixel.isPrototypeOf(pixel)    // true

    // Pixel instances inhertis from `Color`
    Color.isPrototypeOf(pixel);   // true

    // In fact `Pixel` itself inherits from `Color`, remember just simple and
    // pure prototypal inheritance where object inherit from objects.
    Color.isPrototypeOf(Pixel);   // true

### Classes ###

Module exports `Class` function. `Class` takes argument of exemplar object
extending `Base` and returns `constructor` function that can be used for
simulating classes defined by given exemplar.

    var CPixel = Class(Pixel);
    var pixel = CPixel(11, 12, '000000');
    pixel instanceof CPixel     // true
    Pixel.prototypeOf(pixel);   // true

    // Use of `new` is optional, but possible.
    var p2 = CPixel(17, 2, 'cccccc');
    p2 instanceof CPixel      // true
    p2.prototypeOf(pixel);    // true
