/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


const { on, once, off } = require('./event/core');
const { method } = require('./utils/function');

exports.EventEmitter = require("./traits").Trait.compose({
  on: function(type, listener) {
    on(this._public, type, listener);
    return this._public;
  },
  once: function(type, listener) {
    once(this._public, type, listener);
    return this._public;
  },
  removeListener: function(type, listener) {
    off(this._public, type, listener);
    return this._public;
  }
});

exports.EventEmitterTrait = require('./light-traits').Trait({
  on: function(type, listener) {
    on(this, type, listener);
    return this;
  },
  once: function(type, listener) {
    once(this, type, listener);
    return this;
  },
  removeListener: function(type, listener) {
    off(this, type, listener);
    return this;
  }
});
