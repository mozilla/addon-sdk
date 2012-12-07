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
const { ns } = require("../core/namespace");
const array = require("./array");

var methods = [
  "reverse", "forEach", "map", "reduce",
  "reduceRight", "filter", "some", "every"
];

var ArrayMethods = methods.reduce(function(methods, name) {
  var method = Array.prototype[name];
  methods[name] = function() {
    return method.apply(listNS(this).keyValueMap, arguments);
  };
  return methods;
}, {})

var registry = ns()

const Registry = Class({
  implements: [Disposable, ArrayMethods],
  extends: EventTarget,
  Type: null,

  setup: function setup(Type) {
    registry(this).elements = [];
    this.Type = Type;
  },
  dispose: function dispose() {
    let elements = registry(this).elements.slice(0);
    for each (let instance in elements)
      emit(this, "remove", instance);
    registry(this).elements.splice(0);
    off(this);
  },
  has: function has(instance) {
    return array.has(registry(this).elements, instance);
  },
  add: function add(instance) {
    let Type = this.Type;
    let elements = registry(this).elements;
    if (!(instance instanceof Type)) instance = new Type(instance);
    if (!array.has(elements, instance)) {
      array.add(elements, instance);
      emit(this, "add", instance);
    }
    return instance;
  },
  remove: function remove(instance) {
    let elements = registry(this).elements;
    if (array.has(elements, instance)) {
      emit(this, "remove", instance);
      array.remove(elements, instance);
    }
  }
});

exports.Registry = Registry;
