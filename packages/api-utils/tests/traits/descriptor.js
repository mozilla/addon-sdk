'use strict'

var Trait = require('light-traits').Trait
,   utils = require('./utils')
,   Data = utils.Data
,   Method = utils.Method
,   Accessor = utils.Accessor
,   Required = utils.Required
,   Conflict = utils.Conflict

function method() {}

exports.Assert = require('./assert').Assert
exports['test simple composition'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait({ a: 0, b: 1 })
    , { c: { value: 2 }, d: { value: method, enumerable: true } }
    )
  , { a: Data(0)
    , b: Data(1)
    , c: Data(2, false, false, false)
    , d: Method(method, true, false, false)
    }
  )
}

exports['test composition with conflict'] = function(assert) {
  assert.equalTraits
  (
    Trait
    ( Trait({ a: 0, b: 1 })
    , { a: { value: 2, writable: true, configurable: true, enumerable: true }
      , c: { value: method, configurable: true }
      }
    )
  , { a: Conflict('a')
    , b: Data(1)
    , c: Method(method, false, true, false)
    }
  )
}

exports['test composition of identical props does not cause conflict'] = function(assert) {
  assert.equalTraits
  (
    Trait
    ( { a: { value: 0, writable: true, configurable: true, enumerable: true }
      , b: { value: 1 }
      }
    , Trait({ a: 0, c: method })
    ),
    { a: Data(0)
    , b: Data(1, false, false, false)
    , c: Method(method)
    }
  )
}

exports['test composition with identical required props'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait({ a: Trait.required, b: 1 })
    , { a: { required: true }, c: { value: method } }
    )
  , { a: Required()
    , b: Data(1)
    , c: Method(method, false, false, false)
    }
  )
}

exports['test composition satisfying a required prop'] = function(assert) {
  assert.equalTraits
  (
    Trait
    ( Trait({ a: Trait.required, b: 1 })
    , { a: { value: method, enumerable: true } }
    )
  , { a: Method(method, true, false, false)
    , b: Data(1)
    }
  )
}

exports['test compose is neutral wrt conflicts'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait({ a: { value: 1 } }, Trait({ a: 2 }))
    , { b: { value: 0, writable: true, configurable: true, enumerable: false } }
    )
  , { a: Conflict('a')
    , b: Data(0, false)
    }
  )
}

exports['test conflicting prop overrides Trait.required prop'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait( Trait({ a: 1 }), { a: { value: 2 } } )
    , { a: { value: Trait.required } }
    )
  , { a: Conflict('a') }
  )
}

exports['test compose is commutative'] = function(assert) {
  assert.equalTraits
  ( Trait(Trait({ a: 0, b: 1 }), { c: { value: 2 }, d: { value: method } })
  , Trait({ c: { value: 2 }, d: { value: method } }, Trait({ a: 0, b: 1 }))
  )
}

exports['test compose is commutative, also for required/conflicting props'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( { a: { value: 0 }
      , b: { value: 1 }
      , c: { value: 3 }
      , e: { value: Trait.required }
      }
    , { c: { value: 2 }, d: { get: method } }
    )
  , Trait
    ( Trait({ c: 3 })
    , { c: { value: 2 }
      , d: { get: method }
      , a: { value: 0 }
      , b: { value: 1 }
      , e: { value: Trait.required }
      }
    )
  )
}

exports['test compose is associative'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( { a: { value: 0 }
      , b: { value: 1 }
      , c: { value: 3 }
      , d: { value: Trait.required }
      }
    , Trait
      ( { c: { value: 3 }, d: { value: Trait.required } }
      , { c: { value: 2 }, d: { value: method }, e: { value: 'foo' } }
      )
    )
  , Trait
    ( Trait
      ( { a: { value: 0 }
        , b: { value: 1 }
        , c: { value: 3 }
        , d: { value: Trait.required }
        }
      , { c: { value: 3 }, d: { value: Trait.required } }
      )
    , { c: { value: 2 }, d: { value: method }, e: { value: 'foo' } }
    )
  )
}

exports['test diamond import of same prop does not generate conflict'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait
      ( { b: { value: 2 } }
      , { a: { value: 1, enumerable: true, configurable: true, writable: true } }
      )
    , Trait({ c: { value: 3 } }, Trait({ a: 1 }))
    , Trait({ d: 4 })
    )
  , { a: Data(1)
    , b: Data(2, false, false, false)
    , c: Data(3, false, false, false)
    , d: Data(4)
    }
  )
}

exports['test create simple'] = function(assert) {
  var o1 = Trait
  ( Trait({ a: 1 })
  , { b: { value: function() { return this.a } } }
  ).create(Object.prototype)

  assert.equal
  ( Object.getPrototypeOf(o1)
  , Object.prototype
  , 'o1 prototype'
  )
  assert.equal(1, o1.a, 'o1.a')
  assert.equal(1, o1.b(), 'o1.b()')
  assert.equal
  ( Object.keys(o1).length
  , 1
  , 'Object.keys(o1).length === 2'
  )
}

exports['test create with Array.prototype'] = function(assert) {
  var o2 = Trait({}, {}).create(Array.prototype)
  assert.equal
  ( Object.getPrototypeOf(o2)
  , Array.prototype
  , 'o2 prototype'
  )
}

exports['test exception for incomplete required properties'] = function(assert) {
  assert.throws
  ( function() { Trait({ foo: Trait.required }).create(Object.prototype) }
  , 'Missing required property: `foo`'
  , 'required prop error'
  )
}

exports['test exception for unresolved conflicts'] = function(assert) {
  assert.throws
  ( function() { Trait(Trait({ a: 0 }), Trait({ a: 1 })).create({}) }
  , 'Remaining conflicting property: `a`'
  , 'conflicting prop error'
  )
}

exports['test verify that conflicting properties are present'] = function(assert) {
  var o5 = Object.create
    ( Object.prototype
    , Trait({ a: { value: 0 } }, { a: { value: 1 } })
    )
  assert.ok('a' in o5, 'conflicting property present')
  assert.throws
  ( function() { o5.a }
  , 'Remaining conflicting property: `a`'
  , 'conflicting prop access error'
  )
}

exports['test diamond with conflicts'] = function(assert) {
  function makeT1(x) { return { m: { value: function() { return x } } } }
  function makeT2(x) { return Trait(Trait({ t2: 'foo' }), makeT1(x)) }
  function makeT3(x) { return Trait({ t3: { value: 'bar' } }, makeT1(x)) }

  var T4 = Trait(makeT2(5), makeT3(5))

  assert.throws
  ( function() { T4.create(Object.prototype) }
  , 'Remaining conflicting property: `m`'
  , 'diamond prop conflict'
  )
}

exports['test providing requirements through proto'] = function(assert) {
  var t = Trait
  ( {}
  , { required: { required: true } }
  ).create({ required: 'test' })
  assert.equal(t.required, 'test', 'property from proto is inherited')
}

// Disabling this check since it is not yet supported by jetpack.
//if (module == require.main) require('test').run(exports)
