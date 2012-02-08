/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


const { on, once, off, emit } = require('./event/core');
const { method } = require('./utils/function');
const WARNING = 'This API is deprecated and will be removed in an upcoming ' +
                'version please use "api-utils/event/target" instead';

exports.EventEmitter = require("./traits").Trait.compose({
  on: function(type, listener) {
    console.log(type, !listener && Error().stack)
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
  },
  _emit: function(type) {
    console.warn(WARNING);
    emit.apply(null, [ this._public ].concat(Array.slice(arguments)));
    return this._public;
  },
  _removeAllListeners: function(type) {
    console.warn(WARNING);
    type ? off(this._public, type) : off(this._public);
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
  },
  _emit: function(type) {
    console.warn(WARNING);
    emit.apply(null, [ this ].concat(Array.slice(arguments)));
    return this;
  },
  _removeAllListeners: function(type) {
    console.warn(WARNING);
    type ? off(this, type) : off(this);
    return this;
  }
});
