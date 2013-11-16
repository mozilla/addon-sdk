/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};

let { modelFor } = require("./core");
let { map, count } = require("../util/sequence");
let { deprecateUsage } = require("../util/deprecate");

// Takes view iterator and returns iterator for modules. For legacy
// returned object will have array like index based access and
// `length` property.
let fromViews = iterator => makeIndexed(map(modelFor, iterator));
exports.fromViews = fromViews;

// Takes regular set and returns proxy for it that implements
// deprecated list API with by index access and `length` getter.
let makeIndexed = sequence => {
  let extra = { get length() count(sequence) }
  return new Proxy(sequence, {
    has: (target, name) => {
      let index = parseInt(name, 10);
      return !Number.isNaN(index) || name in target || name in extra;
    },
    get: (target, name) => {
      // Interpret property as an index.
      let index = parseInt(name, 10);

      if (Number.isNaN(index)) return target[name] || extra[name];

      deprecateUsage("Access by index is no longer supported");
      for (let item of target) {
        if (index === 0) return item
        index = index - 1
      }
      return target[name];
    }
  });
}