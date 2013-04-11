/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require('../core/heritage');
const { MatchPattern } = require('./match-pattern');
const { on, off, emit } = require('../event/core');
const { method } = require('../lang/functional');
const objectUtil = require('./object');
const cache = require('../core/namespace').ns();

// Should deprecate usage of EventEmitter/compose
const Rules = Class({
  initialize: function() {
    cache(this).registry = {};
  },
  add: function() Array.slice(arguments).forEach(function onAdd(rule) {
    if (has(this, rule)) return;
    add(this, rule);
    emit(this, 'add', rule);
  }.bind(this)),
  remove: function() Array.slice(arguments).forEach(function onRemove(rule) {
    if (!has(this, rule)) return;
    remove(this, rule);
    emit(this, 'remove', rule);
  }.bind(this)),
  get: function(rule) registry(this)[rule],
  // Returns true if uri matches atleast one stored rule
  matchesAny: function(uri) !!filterMatches(this, uri).length,
  forEach: method(each),
  toArray: function() Object.keys(registry(this)),
  toString: function() '[object Rules]'
});
exports.Rules = Rules;

function filterMatches(instance, uri) {
  let matches = [];
  each(instance, function (rule, pattern) {
    if (pattern.test(uri)) matches.push(rule);
  });
  return matches;
}

function registry (instance) cache(instance).registry
function has (instance, key) objectUtil.has(registry(instance), key)
function each (instance, fn) objectUtil.each(registry(instance), fn)
function add (instance, rule) registry(instance)[rule] = new MatchPattern(rule)
function remove (instance, rule) delete registry(instance)[rule]
