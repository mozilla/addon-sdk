/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { invoke, defer, curry, compose } = require('utils/function');

exports['test forwardApply'] = function(assert) {
  function sum(b, c) this.a + b + c
  assert.equal(invoke(sum, [2, 3], { a: 1 }), 6,
               'passed arguments and pseoude-variable are used');

  assert.equal(invoke(sum.bind({ a: 2 }), [2, 3], { a: 1 }), 7,
               'bounded `this` pseoudo variable is used');
}

exports['test deferred function'] = function(assert, done) {
  let nextTurn = false;
  function sum(b, c) {
    assert.ok(nextTurn, 'enqueued is called in next turn of event loop');
    assert.equal(this.a + b + c, 6,
                 'passed arguments an pseoude-variable are used');
    done();
  }

  let fixture = { a: 1, method: defer(sum) }
  fixture.method(2, 3);
  nextTurn = true;
};

exports['test curry function'] = function(assert) {
  function sum(b, c) this.a + b + c;

  let foo = { a : 5 };

  foo.sum7 = curry(sum, 7);
  foo.sum8and4 = curry(sum, 8, 4);

  assert.equal(foo.sum7(2), 14, 'curry one arguments works');

  assert.equal(foo.sum8and4(), 17, 'curry both arguments works');
};

exports["test compose"] = function(assert) {
  let greet = function(name) { return 'hi: ' + name; };
  let exclaim = function(sentence) { return sentence + '!'; };

  assert.equal(compose(exclaim, greet)('moe'), 'hi: moe!',
               'can compose a function that takes another');

  assert.equal(compose(greet, exclaim)('moe'), 'hi: moe!',
               'in this case, the functions are also commutative');

  var target = {
    name: 'Joe',
    greet: compose(function exclaim(sentence) {
      return sentence + '!'
    }, function(title) {
      return 'hi : ' + title + ' ' + this.name;
    })
  }

  assert.equal(target.greet('Mr'), 'hi : Mr Joe!',
               'this can be passed in');
  assert.equal(target.greet.call({ name: 'Alex' }, 'Dr'), 'hi : Dr Alex!',
               'this can be applied');
};

require('test').run(exports);
