/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { EventTarget } = require("../event/target");
const { emit, off } = require("../event/core");
const { Class } = require('../core/heritage');
const { Disposable } = require("../core/disposable");
const array = require("./array");

const Registry = Class({
  implements: [Disposable],
  extends: EventTarget,

  _registry: null,
  Type: null,

  setup: function setup(Type) {
    this._registry = [];
    this.Type = Type;
  },
  dispose: function dispose() {
    let registry = this._registry.slice(0);
    for each (let instance in registry)
      emit(this, "remove", instance);
    this._registry.splice(0);
    off(this);
  },
  has: function has(instance) {
    return array.has(this._registry, instance);
  },
  add: function add(instance) {
    let { Type, _registry } = this;
    if (!(instance instanceof Type)) instance = new Type(instance);
    if (!array.has(_registry, instance)) {
      array.add(_registry, instance);
      emit(this, "add", instance);
    }
    return instance;
  },
  remove: function remove(instance) {
    let registry = this._registry;
    if (array.has(registry, instance)) {
      emit(this, "remove", instance);
      array.remove(registry, instance);
    }
  }
});

exports.Registry = Registry;
