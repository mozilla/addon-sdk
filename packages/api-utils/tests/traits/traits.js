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
exports['test empty trait'] = function(assert) {
  assert.equalTraits
  ( Trait({})
  , {}
  )
}
exports['test simple trait'] = function(assert) {
  assert.equalTraits
  ( Trait(
    { a: 0,
      b: method
    })
  , {
      a: Data(0, true, true, true),
      b: Method(method, true, true, true)
    }
  )
}
exports['test simple trait with Trait.required property'] = function(assert) {
  assert.equalTraits
  ( Trait(
    { a: Trait.required
    , b: 1
    })
  ,
    { a: Required('a')
    , b: Data(1)
    }
  )
}

exports['test ordering of trait properties is irrelevant'] = function(assert) {
  assert.equalTraits
  ( Trait(
    { a: 0
    , b: 1
    , c: Trait.required
    })
  ,
    Trait(
    { b: 1
    , c: Trait.required
    , a: 0
    })
  )
}

exports['test trait with accessor property'] = function(assert) {
  var record = { get a() {}, set a(v) {} }
  var get = Object.getOwnPropertyDescriptor(record,'a').get
  var set = Object.getOwnPropertyDescriptor(record,'a').set
  assert.equalTraits
  ( Trait(record)
  , { a: Accessor(get, set ) }
  )
}

exports['test simple composition'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait({ a: 0, b: 1 })
    , Trait({ c: 2, d: method })
    )
  , { a: Data(0)
    , b: Data(1)
    , c: Data(2)
    , d: Method(method)
    }
  )
}

exports['test composition with conflict'] = function(assert) {
  assert.equalTraits
  (
    Trait
    ( Trait({ a: 0, b: 1 })
    , Trait({ a: 2, c: method })
    )
  , { a: Conflict('a')
    , b: Data(1)
    , c: Method(method)
    }
  )
}

exports['test composition of identical props does not cause conflict'] = function(assert) {
  assert.equalTraits
  (
    Trait
    (
      Trait({ a: 0, b: 1 }),
      Trait({ a: 0, c: method })
    ),
    { a: Data(0)
    , b: Data(1)
    , c: Method(method)
    }
  )
}

exports['test composition with identical Trait.required props'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait({ a: Trait.required, b: 1 })
    , Trait({ a: Trait.required, c: method })
    )
  , { a: Required()
    , b: Data(1)
    , c: Method(method)
    }
  )
}

exports['test composition satisfying a Trait.required prop'] = function(assert) {
  assert.equalTraits
  (
    Trait
    ( Trait({ a: Trait.required, b: 1 })
    , Trait({ a: method })
    )
  , { a: Method(method)
    , b: Data(1)
    }
  )
}

exports['test compose is neutral wrt conflicts'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait(Trait({ a: 1 }), Trait({ a: 2 }))
    , Trait({ b: 0 })
    )
  , { a: Conflict('a')
    , b: Data(0)
    }
  )
}

exports['test conflicting prop overrides Trait.required prop'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait( Trait({ a: 1 }), Trait({ a: 2 }) )
    , Trait({ a: Trait.required })
    )
  , { a: Conflict('a') }
  )
}

exports['test compose is commutative'] = function(assert) {
  assert.equalTraits
  ( Trait(Trait({ a: 0, b: 1 }), Trait({ c: 2, d: method }))
  , Trait(Trait({ c: 2, d: method }), Trait({ a: 0, b: 1 }))
  )
}

exports['test compose is commutative, also for Trait.required/conflicting props'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait({ a: 0, b: 1, c: 3, e: Trait.required })
    , Trait({ c: 2, d: method })
    )
  , Trait
    ( Trait({ c: 2, d: method })
    , Trait({ a: 0, b: 1, c: 3, e: Trait.required })
    )
  )
}

exports['test compose is associative'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait({ a: 0, b: 1, c: 3, d: Trait.required })
    , Trait
      ( Trait({ c: 3, d: Trait.required })
      , Trait({ c: 2, d: method, e: 'foo' })
      )
    )
  , Trait
    ( Trait
      ( Trait({ a: 0, b: 1, c: 3, d: Trait.required })
      , Trait({ c: 3, d: Trait.required })
      )
    , Trait({ c: 2, d: method, e: 'foo' })
    )
  )
}

exports['test diamond import of same prop does not generate conflict'] = function(assert) {
  assert.equalTraits
  ( Trait
    ( Trait(Trait({ b: 2 }), Trait({ a: 1 }))
    , Trait(Trait({ c: 3 }), Trait({ a: 1 }))
    , Trait({ d: 4 })
    )
  , { a: Data(1), b: Data(2), c: Data(3), d: Data(4) }
  )
}

exports['test resolve with empty resolutions has no effect'] = function(assert) {
  assert.equalTraits
  ( Trait(
    { a: 1
    , b: Trait.required
    , c: method
    }).resolve({})
  , { a: Data(1)
    , b: Required()
    , c: Method(method)
    }
  )
}

exports['test resolve: renaming'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: Trait.required, c: method }).resolve({ a: 'A', c: 'C' })
  , { A: Data(1)
    , b: Required()
    , C: Method(method)
    , a: Required()
    , c: Required()
    }
  )
}

exports['test resolve: renaming to conflicting name causes conflict, order 1'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: 'b'})
  , { b: Conflict('b')
    , a: Required()
    }
  )
}

exports['test resolve: renaming to conflicting name causes conflict, order 2'] = function(assert) {
  assert.equalTraits
  ( Trait({ b: 2, a: 1 }).resolve({ a: 'b' })
  , { b: Conflict('b'), a: Required() }
  )
}

exports['test resolve: simple exclusion'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: undefined })
  , { a: Required(), b: Data(2) }
  )
}

exports['test resolve: exclusion to "empty" trait'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: null, b: undefined })
  , { a: Required(), b: Required() }
  )
}

exports['test resolve: exclusion and renaming of disjoint props'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: undefined, b: 'c' })
  , { a: Required(), c: Data(2), b: Required() }
  )
}

exports['test resolve: exclusion and renaming of overlapping props'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: undefined, b: 'a' })
  , { a: Data(2), b: Required() }
  )
}

exports['test resolve: renaming to a common alias causes conflict'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: 'c', b: 'c' })
  , { c: Conflict('c'), a: Required(), b: Required() }
  )
}

exports['test resolve: renaming overrides Trait.required target'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: Trait.required, b: 2 }).resolve({ b: 'a' })
  , { a: Data(2), b: Required() }
  )
}

exports['test resolve: renaming Trait.required properties has no effect'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 2, b: Trait.required }).resolve({ b: 'a' })
  , { a: Data(2), b: Required() }
  )
}

exports['test resolve: renaming of non-existent props has no effect'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: 'c', d: 'c' })
  , { c: Data(1), b: Data(2), a: Required() }
  )
}

exports['test resolve: exclusion of non-existent props has no effect'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1 }).resolve({ b: undefined })
  , { a: Data(1) }
  )
}

exports['test resolve is neutral w.r.t. Trait.required properties'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: Trait.required, b: Trait.required, c: 'foo', d: 1 }).resolve(
    { a: 'c'
    , b: undefined
    })
  , { a: Required()
    , b: Required()
    , c: Data('foo')
    , d: Data(1)
    }
  )
}

exports['test resolve supports swapping of property names, ordering 1'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ a: 'b', b: 'a' })
  , { a: Data(2), b: Data(1) }
  )
}

exports['test resolve supports swapping of property names, ordering 2'] = function(assert) {
  assert.equalTraits
  ( Trait({ a: 1, b: 2 }).resolve({ b: 'a', a: 'b' })
  , { a: Data(2), b: Data(1) }
  )
}

exports['test resolve supports swapping of property names, ordering 3'] = function(assert) {
  assert.equalTraits
  ( Trait({ b: 2, a: 1 }).resolve({ b: 'a', a: 'b' })
  , { a: Data(2), b: Data(1) }
  )
}

exports['test resolve supports swapping of property names, ordering 4'] = function(assert) {
  assert.equalTraits
  ( Trait({ b: 2, a: 1 }).resolve({ a: 'b', b: 'a' })
  , { a: Data(2), b: Data(1) }
  )
}

exports['test create simple'] = function(assert) {
  var o1 = Trait(
  { a: 1
  , b: function() { return this.a }
  }).create(Object.prototype)

  assert.equal
  ( Object.getPrototypeOf(o1)
  , Object.prototype
  , 'o1 prototype'
  )
  assert.equal(1, o1.a, 'o1.a')
  assert.equal(1, o1.b(), 'o1.b()')
  assert.equal
  ( Object.keys(o1).length
  , 2
  , 'Object.keys(o1).length === 2'
  )
}

exports['test create with Array.prototype'] = function(assert) {
  var o2 = Trait({}).create(Array.prototype)
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

exports['test verify that required properties are present but undefined'] = function(assert) {
  var o4 = Object.create(Object.prototype, Trait({ foo: Trait.required }))
  assert.ok('foo' in o4, 'required property present')
  assert.throws
  ( function() { o4.foo }
  , 'Missing required property: `foo`'
  , 'required prop error'
  )
}

exports['test verify that conflicting properties are present'] = function(assert) {
  var o5 = Object.create
    ( Object.prototype
    , Trait(Trait({ a: 0 }), Trait({ a: 1 }))
    )
  assert.ok('a' in o5, 'conflicting property present')
  assert.throws
  ( function() { o5.a }
  , 'Remaining conflicting property: `a`'
  , 'conflicting prop access error'
  )
}

exports['test diamond with conflicts'] = function(assert) {
  function makeT1(x) { return Trait({ m: function() { return x } }) }
  function makeT2(x) { return Trait(Trait({ t2: 'foo' }), makeT1(x)) }
  function makeT3(x) { return Trait(Trait({ t3: 'bar' }), makeT1(x)) }

  var T4 = Trait(makeT2(5), makeT3(5))

  assert.throws
  ( function() { T4.create(Object.prototype) }
  , 'Remaining conflicting property: `m`'
  , 'diamond prop conflict'
  )
}

exports['test providing requirements through proto'] = function(assert) {
  var t = Trait({ required: Trait.required }).create({ required: 'test' })
  assert.equal(t.required, 'test', 'property from proto is inherited')
}

