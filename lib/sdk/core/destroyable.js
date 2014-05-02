/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'experimental'
};

const { Class } = require('./heritage');
const { on, off } = require('../system/events');
const { when: unload } = require('../system/unload');
const { add, has, remove, iterator } = require("../lang/weak-set");

const destroyablesWeakSet = {};
const destroyablesStrongSet = Set();

const DESTROYED = function() {};

function dispose(instance) {
  let handler = destroyables.get(instance);
  if (handler) off("sdk:loader:destroy", handler);
  destroyables.delete(instance);
}
exports.dispose = dispose;

const Destroyable = Class({
  _enableGC: false,  // set _enableGC to true if the object should be GCable
  initialize: function() {
    this.setup.apply(this, arguments);

    // make sure this.destroy is called on unload if it's not gc'd
    if (this._enableGC) {
      add(destroyablesWeakSet, this);
    }
    else {
      destroyablesStrongSet.add(this);
    }
  },
  setup: function() {
    // Implement your initialize logic here.
  },
  destroy: function() {
    // Implement your cleanup logic here.
  },
  dispose: function() {
    // prevent dispose from being called on unload
    if (this._enableGC) {
      if (has(destroyablesWeakSet, this)) {
        remove(destroyablesWeakSet, this);
      }
    }
    else {
      destroyablesStrongSet.delete(this);
    }

    try {
      this.destroy();
    }
    catch (e) {
      console.exception(e);
    }
    this.destroy = this.dispose = DESTROYED;
  }
});
exports.Destroyable = Destroyable;

unload(function(reason) {
  if (reason != 'shutdown') {
    for (let destroyable of iterator(destroyablesWeakSet)) {
      destroyable.dispose();
    }

    destroyablesStrongSet.forEach(destroyable => destroyable.dispose());
  }
});
