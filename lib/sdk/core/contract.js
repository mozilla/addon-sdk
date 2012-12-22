/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { validateOptions: valid } = require("../deprecated/api-utils");

function contract(rules) {
  function validator(options) {
    return valid(options || {}, rules);
  }
  validator.rules = rules
  validator.properties = function(model) {
    return properties(model, rules);
  }
  return validator;
}
exports.contract = contract

function properties(model, rules) {
  let descriptor = Object.keys(rules).reduce(function(descriptor, name) {
    descriptor[name] = {
      get: function() { return model(this)[name] },
      set: function(value) {
        let change = {};
        change[name] = value;
        model(this)[name] = valid(change, rules)[name];
      }
    }
    return descriptor
  }, {});
  return Object.create(Object.prototype, descriptor);
}
exports.properties = properties
