"use strict";

module.metadata = {
  "stability": "experimental"
};


let { Class } = require("./heritage");
let { on, off } = require('../system/events');
let unloadSubject = require('@loader/unload');

function DisposeHandler(disposable) {
  return function onDisposal({subject}) {
    if (subject.wrappedJSObject === unloadSubject) {
      off("sdk:loader:destroy", onDisposal);
      disposable.dispose();
    }
  }
}

// Base type that takes care of disposing it's instances on add-on unload.
// Also makes sure to remove unload listener if it's already being disposed.
let Disposable = Class({
  initialize: function dispose() {
    this.setupDisposal();
    this.setup.apply(this, arguments);
  },
  setupDisposal: function setupDisposal() {
    // Create `onDisposal` handler that will be invoked on unload of
    // the add-on, unless this is destroyed earlier.
    Object.defineProperty(this, "onDisposal", { value: DisposeHandler(this) });
  },
  teardownDisposable: function tearDisposal() {
    // Removes `onDisposal` handler so that it won't be invoked on unload.
    off("sdk:loader:destroy", this.onDisposal);
  },

  setup: function setup() {
    // Implement your initialize logic here.
  },
  dispose: function dispose() {
    // Implement your cleanup logic here.
  },

  destroy: function destroy() {
    // Destroying disposable removes unload handler so that attempt to dispose
    // won't be made at unload & delegates to dispose.
    this.teardownDisposable();
    this.dispose();
  }
});

exports.Disposable = Disposable;
