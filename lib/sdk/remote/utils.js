/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Class } = require('../core/heritage');
const { List, addListItem, removeListItem } = require('../util/list');
const { emit } = require('../event/core');

function forwardEvents(source, target, extraArg) {
  let listener = (event, ...args) => {
    emit(target, event, extraArg, ...args);
  }

  source.on('*', listener);

  return function detach() {
    source.off('*', listener);
  }
}

const AttachPoint = Class({
  implements: [ List ],

  attachItem: function(item) {
    addListItem(this, item);

    let detachPort = forwardEvents(item.port, this.port, item);
    let detachMain = forwardEvents(item, this, item);

    item.on('detach', () => {
      detachPort();
      detachMain();

      removeListItem(this, item);

      // This event listener runs before the forwarded listeners above so send
      // the detach event manually
      emit(this, 'detach', item);
    })

    emit(this, 'attach', item);
  },

  getById: function(id) {
    for (let item of this) {
      if (item.id == id)
        return item;
    }
    return null;
  },

  forEvery: function(listener) {
    for (let item of this)
      listener(item);

    this.on('attach', listener);
  }
});
exports.AttachPoint = AttachPoint;
