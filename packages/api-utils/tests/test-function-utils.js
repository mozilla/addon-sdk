/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { invoke, Enqueued, curry } = require('utils/function');

exports['test forwardApply'] = function(test) {
  function sum(b, c) this.a + b + c
  test.assertEqual(invoke(sum, [2, 3], { a: 1 }), 6,
                   'passed arguments and pseoude-variable are used');
  test.assertEqual(invoke(sum.bind({ a: 2 }), [2, 3], { a: 1 }), 7,
                   'bounded `this` pseoudo variable is used')
}

exports['test enqueued function'] = function(test) {
  test.waitUntilDone();
  let nextTurn = false;
  function sum(b, c) {
    test.assert(nextTurn, 'enqueued is called in next turn of event loop');
    test.assertEqual(this.a + b + c, 6,
                     'passed arguments an pseoude-variable are used');
    test.done();
  }
  let fixture = { a: 1, method: Enqueued(sum) }
  fixture.method(2, 3);
  nextTurn = true;
}

exports['test curry function'] = function(test) {
  function sum(b, c) this.a + b + c;

  let foo = {a : 5};

  foo.sum7 = curry(sum, 7);
  foo.sum8and4 = curry(sum, 8, 4);

  test.assertEqual(foo.sum7(2), 14,
                    'curry one arguments works');

  test.assertEqual(foo.sum8and4(), 17,
                    'curry both arguments works');
}