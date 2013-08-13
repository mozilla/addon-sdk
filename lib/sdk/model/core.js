/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { method, define } = require("method/core");

let dispatcher = (hint) => {
  let implementations = new Map();
  let dispatch = (...args) => {
    var value = args[0]
    for (let [type, implementation] of implementations) {
      if (value instanceof type)
        return implementation.apply(implementation, args);
    }

    return dispatch.Default.apply(dispatch.Default, args);
  };
  dispatch.implementations = implementations;
  dispatch.define = (type, fn) => define(dispatch, type, fn)
  dispatch.implement = (type, fn) => implement(dispatch, type, fn)
  dispatch.Default = method(hint);
  define.implement(dispatch, dispatcher.define);

  return dispatch;
};

dispatcher.define = (dispatch, type, implementation) => {
  dispatch.implementations.set(type, implementation);
  define(dispatch.Default, type, implementation);
};

exports.modelFor = dispatcher("modelFor");