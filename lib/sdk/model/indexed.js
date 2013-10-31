/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

module.metadata = {
  "stability": "unstable"
};

let { count, nth, first, drop } = require("../util/sequence");
let { deprecated } = require("../util/deprecate");
let { method } = require("../lang/functional");
let { iteratorSymbol } = require("../util/iteration");

// Only reason to implement index based access on collections is
// a backwards compatibility. In ordert to eventuall migrate
// we print deprecation warnings on access by index.
nth = deprecated("Access by index is no longer supported", nth);
count = deprecated("Property length is no longer supported", count);

// Predicate to check if proprety name is an index.
let isIndex = name => /^\d+$/.test(name);

// Utility function enabling backwards compatibility with
// code that does `for each` statements.
let forof = function(xs, onKeys, onPairs) {
  let index = 0;
  for (let x of xs) {
    yield onPairs ? [index, x] :
          onKeys ? index :
          x;
    index = index + 1;
  }
}

let WARN_FOR_OF = "Use standard `for of` iteration syntax instead of " +
    "legacy `for each`. For more details see:\n" +
    "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of";

// Base class that implements array like indexed access on it items.
// Class requires `iterator` method to be implemented in order to
// function. Class can be only subclassed, mixing it in isn't gonig
// to work.
function Indexed() {}
let base = new Proxy(Object.prototype, {
  has: (target, name, receiver) => isIndex(name) || name in target,
  get: (target, name, receiver) =>
    isIndex(name) ? nth(receiver, parseInt(name, 10)) : target[name]
});
Indexed.prototype = Object.create(base, {
  length: { get: method(count) },
  iterator: { value: _ => { throw TypeError("Inedxed instance must implement" +
                                            " required `iterator` method") },
              writable: true },
  // For legacy reasons also implement support `for each` statements.
  __iterator__: { value: deprecated(WARN_FOR_OF, method(forof)) },
});
Indexed.prototype[iteratorSymbol] = function*(...args) {
  let items = this.iterator(...args)
  for (let item of items)
    yield item;
};

exports.Indexed = Indexed;
