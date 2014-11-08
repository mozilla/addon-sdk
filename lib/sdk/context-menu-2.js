"use strict";

const shared = require("toolkit/require");
const { Item, Seperator, Menu, Contexts, Readers } = shared.require("./context-menu/core");
const { setupDisposable, disposeDisposable } = require("sdk/core/disposable")
const { Class } = require("sdk/core/heritage")

const makeDisposable = Type => Class({
  extends: Type,
  setup(...params) {
    Type.prototype.setup.call(this, ...params);
    setupDisposable(this);
  },
  dispose(...params) {
    disposeDisposable(this);
    Type.prototype.dispose.call(this, ...params);
  }
});

exports.Seperator = Seperator;
exports.Contexts = Contexts;
exports.Readers = Readers;

// Subclass Item & Menu shared classes so their items
// will be unloaded when add-on is unloaded.
exports.Item = makeDisposable(Item);
exports.Menu = makeDisposable(Menu);
