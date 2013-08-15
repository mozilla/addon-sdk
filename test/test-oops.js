/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


const { chainable, field, query, isInstance } = require("sdk/util/oops");


exports["test chainable"] = function(assert) {
  let Player = function () { this.volume = 5; };
  Player.prototype = {
    setBand: chainable(function (band) this.band = band),
    incVolume: chainable(function () this.volume++)
  };
  let player = new Player();
  player
    .setBand('Animals As Leaders')
    .incVolume().incVolume().incVolume().incVolume().incVolume().incVolume();

  assert.equal(player.band, 'Animals As Leaders', 'passes arguments into chained');
  assert.equal(player.volume, 11, 'accepts no arguments in chain');
};

exports["test field"] = (assert) => {
  let Num = field("constructor", 0);
  assert.equal(Num.name, Number.name);
  assert.ok(typeof(Num), "function");

  let x = field("x");

  [
    [field("foo", { foo: 1 }), 1],
    [field("foo")({ foo: 1 }), 1],
    [field("bar", {}), undefined],
    [field("bar")({}), undefined],
    [field("hey", undefined), undefined],
    [field("hey")(undefined), undefined],
    [field("how", null), null],
    [field("how")(null), null],
    [x(1), undefined],
    [x(undefined), undefined],
    [x(null), null],
    [x({ x: 1 }), 1],
    [x({ x: 2 }), 2],
  ].forEach(([actual, expected]) => assert.equal(actual, expected));
};

exports["test query"] = (assert) => {
  let Num = query("constructor", 0);
  assert.equal(Num.name, Number.name);
  assert.ok(typeof(Num), "function");

  let x = query("x");
  let xy = query("x.y");

  [
    [query("foo", { foo: 1 }), 1],
    [query("foo")({ foo: 1 }), 1],
    [query("foo.bar", { foo: { bar: 2 } }), 2],
    [query("foo.bar")({ foo: { bar: 2 } }), 2],
    [query("foo.bar", { foo: 1 }), undefined],
    [query("foo.bar")({ foo: 1 }), undefined],
    [x(1), undefined],
    [x(undefined), undefined],
    [x(null), null],
    [x({ x: 1 }), 1],
    [x({ x: 2 }), 2],
    [xy(1), undefined],
    [xy(undefined), undefined],
    [xy(null), null],
    [xy({ x: 1 }), undefined],
    [xy({ x: 2 }), undefined],
    [xy({ x: { y: 1 } }), 1],
    [xy({ x: { y: 2 } }), 2]
  ].forEach(([actual, expected]) => assert.equal(actual, expected));
};

exports["test isInstance"] = (assert) => {
  function X() {}
  function Y() {}
  let isX = isInstance(X);

  [
    isInstance(X, new X),
    isInstance(X)(new X),
    !isInstance(X, new Y),
    !isInstance(X)(new Y),
    isX(new X),
    !isX(new Y)
  ].forEach(x => assert.ok(x));
};

require("test").run(exports);
