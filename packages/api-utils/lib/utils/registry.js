/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { EventEmitter } = require('../events');
const { emit } = require('../event/core');
const unload = require('../unload');

const Registry = EventEmitter.compose({
  _registry: null,
  _constructor: null,
  constructor: function Registry(constructor) {
    this._registry = [];
    this._constructor = constructor;
    unload.ensure(this, "_destructor");
  },
  _destructor: function _destructor() {
    let _registry = this._registry.slice(0);
    for each (let instance in _registry)
      emit(this._public, 'remove', instance);
    this._registry.splice(0);
  },
  has: function has(instance) {
    let _registry = this._registry;
    return (
      (0 <= _registry.indexOf(instance)) ||
      (instance && instance._public && 0 <= _registry.indexOf(instance._public))
    );
  },
  add: function add(instance) {
    let { _constructor, _registry } = this; 
    if (!(instance instanceof _constructor))
      instance = new _constructor(instance);
    if (0 > _registry.indexOf(instance)) {
      _registry.push(instance);
      emit(this._public, 'add', instance);
    }
    return instance;
  },
  remove: function remove(instance) {
    let _registry = this._registry;
    let index = _registry.indexOf(instance)
    if (0 <= index) {
      emit(this._public, 'remove', instance);
      _registry.splice(index, 1);
    }
  }
});
exports.Registry = Registry;

