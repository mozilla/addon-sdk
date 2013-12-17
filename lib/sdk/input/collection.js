/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { foldp, start, lift, merge, write } = require("elmjs/signal");

const Tag = options => {
  const Type = function(value) {
    if (!(this instanceof Type))
      return new Type(value);

    this.value = value;
  };
  Type.prototype = options;
  Type.prototype.constructor = Type;
  Type.prototype.valueOf = function() {
    return this.value;
  };
  return Type;
};

const Delete = Tag({ isDeletion: true });
exports.Delete = Delete;

const Add = Tag({ isAddition: true });
exports.Add = Add;

const Update = Tag({ isUpdate: true });
exports.Update = Update;

const changes = new WeakMap();

const set = (add, remove, initial) => {
  const input = merge(lift(Delete, remove), lift(Add, add));
  return foldp((past, change) => {
    let state = new Set(past);
    if (change.isAddition)
      state.add(change.value);
    if (change.isDeletion)
      state.delete(change.value);

    changes.set(state, change);
    return state;
  }, initial, input);
};
exports.set = set;

const Deltas = input => foldp((_, state) => changes.get(state),
                              input.value,
                              input);
exports.Deltas = Deltas;

set.write = ({start, add, remove, update, end}, input) => {
  write({
    start: start,
    next: change => {
      if (change.isAddition) {
        if (add)
          add(new Set([change.value]));
      }
      if (change.isDeletion) {
        if (remove)
          remove(new Set([change.value]));
      }
      if (change.isUpdate) {
        if (update)
          update(new Set([change.value]));
      }
    },
    end: end
  }, Deltas(input));
};
exports.write = set.write;
