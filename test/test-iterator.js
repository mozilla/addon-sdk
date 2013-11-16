/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

let { LoaderWithHookedConsole } = require("sdk/test/loader");

exports["test length & property access"] = assert => {
  let { loader, messages } = LoaderWithHookedConsole(module);
  let { Iterator } = loader.require("sdk/util/iterator");

  let XS = function() {}
  XS.prototype = Object.create(Iterator.prototype)
  XS.prototype.iterator = function*() {
    yield "a";
    yield "b";
    yield "c";
  }

  let xs = new XS();
  let assertLog = pattern => {
    let { type, msg } = messages.shift();
    assert.equal(type, "error", "error logged");
    assert.ok(pattern.test(msg), "deprecation msg logged");
  }

  assert.equal(xs.length, 3, "length is 3");
  assertLog(/DEPRECATED: Property length/);

  assert.equal(xs[0], "a", "access by index 0");
  assertLog(/DEPRECATED: Access by index/);

  assert.equal(xs[1], "b", "access by index 1");
  assertLog(/DEPRECATED: Access by index/);

  assert.equal(xs[2], "c", "access by index 2");
  assertLog(/DEPRECATED: Access by index/);

  assert.equal(xs[3], undefined, "access by unboaund index");
  assertLog(/DEPRECATED: Access by index/);

  loader.unload();
};

exports["test for in iteration"] = assert => {
  let { loader, messages } = LoaderWithHookedConsole(module);
  let { Iterator } = loader.require("sdk/util/iterator");

  let XS = function() {}
  XS.prototype = Object.create(Iterator.prototype);
  XS.prototype.iterator = function*() {
    yield "a";
    yield "b";
    yield "c";
  };

  let xs = new XS();
  let ys = [];

  let assertLog = pattern => {
    let { type, msg } = messages.shift();
    assert.equal(type, "error", "error logged");
    assert.ok(pattern.test(msg), "deprecation msg logged");
  }

  for (let i in xs)
    ys.push([i, xs[i]]);

  assert.deepEqual(ys, [[0, "a"], [1, "b"], [2, "c"]],
                   "for in works");

  assertLog(/DEPRECATED: Use standard `for of` iteration/);
  assertLog(/DEPRECATED: Access by index/);

  loader.unload();
};

exports["test for each iteration"] = assert => {
  let { loader, messages } = LoaderWithHookedConsole(module);
  let { Iterator } = loader.require("sdk/util/iterator");

  let XS = function() {}
  XS.prototype = Object.create(Iterator.prototype);
  XS.prototype.iterator = function*() {
    yield "a";
    yield "b";
    yield "c";
  };

  let xs = new XS();
  let ys = [];

  let assertLog = pattern => {
    let { type, msg } = messages.shift();
    assert.equal(type, "error", "error logged");
    assert.ok(pattern.test(msg), "deprecation msg logged");
  }

  for each (let x in xs)
    ys.push(x);

  assert.deepEqual(ys, ["a", "b", "c"], "for each works");
  assertLog(/DEPRECATED: Use standard `for of` iteration/);

  loader.unload();
};

exports["test for of iteration"] = assert => {
  let { Iterator } = require("sdk/util/iterator");

  let XS = function() {}
  XS.prototype = Object.create(Iterator.prototype);
  XS.prototype.iterator = function*() {
    yield "a";
    yield "b";
    yield "c";
  };

  let xs = new XS();
  let ys = [];

  for (let x of xs)
    ys.push(x);

  assert.deepEqual(ys, ["a", "b", "c"], "for in works");
};
require("sdk/test").run(exports);
